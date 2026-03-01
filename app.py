import json
import os

import PyPDF2
import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from google import genai
from werkzeug.utils import secure_filename

# Loading environment variables
load_dotenv()

# APP SETUP
app = Flask(__name__)

# Configuration
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16MB max
app.config["UPLOAD_FOLDER"] = "uploads"

# Create uploads folder
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

# Get API keys from environment
OCR_API_KEY = os.getenv("OCR_SPACE_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = os.getenv("MODEL_NAME", "gemini-2.5-flash")

# System instruction for the AI
SYSTEM_INSTRUCTION = """You are a helpful study assistant. Your purpose is to help students understand their study materials and answer their questions.

Guidelines:
- If a document is provided, answer questions based primarily on that document
- Give clear, concise explanations suitable for students
- If you don't know something, say so honestly
- Be encouraging and supportive
- Break down complex topics into simple terms
- Use examples when helpful"""

# Initialize Gemini client with modern google-genai package
client = genai.Client(api_key=GEMINI_API_KEY)


# ROUTE: Homepage
@app.route("/")
def home():
    return render_template("index.html")


# ROUTE: Handle Chat Messages
@app.route("/chat", methods=["POST"])
def chat():
    """Handles incoming chat messages and file uploads"""

    try:
        # Get data from request
        user_message = request.form.get("message", "")
        conversation_history = json.loads(
            request.form.get("conversation_history", "[]")
        )

        # Check for uploaded file
        uploaded_file = request.files.get("file")
        file_type = request.form.get("file_type")

        extracted_text = None

        # Process file if present
        if uploaded_file and file_type:
            filename = secure_filename(uploaded_file.filename)
            filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            uploaded_file.save(filepath)

            print(f"📁 Processing {file_type}: {filename}")

            # Extract text based on file type
            if file_type == "pdf":
                extracted_text = extract_text_from_pdf(filepath)
            elif file_type == "image":
                extracted_text = extract_text_from_image(filepath)

            # Clean up temporary file
            os.remove(filepath)

            if extracted_text:
                print(f"✅ Extracted {len(extracted_text)} characters")

        # Get AI response from Gemini
        bot_response = get_ai_response(
            user_message, conversation_history, extracted_text
        )

        # Update conversation history
        conversation_history.append({"role": "user", "content": user_message})
        conversation_history.append({"role": "assistant", "content": bot_response})

        return jsonify(
            {
                "success": True,
                "response": bot_response,
                "conversation_history": conversation_history,
            }
        )

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({"success": False, "error": str(e)})


# Extract Text from PDF
def extract_text_from_pdf(filepath):
    """Extracting text from PDF using PyPDF2"""

    try:
        text = ""

        with open(filepath, "rb") as file:
            pdf_reader = PyPDF2.PdfReader(file)
            num_pages = len(pdf_reader.pages)

            print(f"📄 PDF has {num_pages} pages")

            # Extract text from each page
            for page_num in range(num_pages):
                page = pdf_reader.pages[page_num]
                page_text = page.extract_text()
                text += page_text + "\n\n"

        if not text.strip():
            return "⚠️ This PDF appears to be image-based. Try converting it to text first or use an image upload."

        return text.strip()

    except Exception as e:
        print(f"Error extracting PDF: {str(e)}")
        return f"❌ Error reading PDF: {str(e)}"


# FUNCTION: Extract Text from Image (OCR.space)
def extract_text_from_image(filepath):
    """Extracting text from image using OCR.space API"""

    try:
        url = "https://api.ocr.space/parse/image"

        with open(filepath, "rb") as image_file:
            payload = {
                "apikey": OCR_API_KEY,
                "language": "eng",
                "isOverlayRequired": False,
                "detectOrientation": True,
                "scale": True,
                "OCREngine": 2,
            }

            files = {"filename": image_file}

            print(f"🖼️ Sending image to OCR.space...")

            response = requests.post(url, data=payload, files=files)
            result = response.json()

            if result.get("OCRExitCode") == 1:
                parsed_text = result.get("ParsedResults", [{}])[0].get("ParsedText", "")

                if parsed_text.strip():
                    print(f"✅ Successfully extracted text from image")
                    return parsed_text.strip()
                else:
                    return "⚠️ No text detected in this image. Make sure the image contains clear, readable text."
            else:
                error_message = result.get("ErrorMessage", ["Unknown error"])[0]
                return f"❌ OCR Error: {error_message}"

    except Exception as e:
        print(f"Error with OCR.space API: {str(e)}")
        return f"❌ Error processing image: {str(e)}"


# FUNCTION: Get AI Response from Gemini
def get_ai_response(user_message, conversation_history, document_text=None):
    """
    Get AI response from Gemini

    Args:
        user_message: The user's current question
        conversation_history: Previous messages in the conversation
        document_text: Text extracted from uploaded document (if any)

    Returns:
        AI-generated response as a string
    """

    try:
        # Build the chat history for Gemini
        chat_history = []

        # Add conversation history
        for msg in conversation_history:
            role = "user" if msg["role"] == "user" else "model"
            chat_history.append({"role": role, "parts": [{"text": msg["content"]}]})

        # Build the current user message
        current_message = user_message

        # If there's a document, prepend it to the message
        if document_text:
            current_message = f"""I have uploaded a document. Here is its content:

---DOCUMENT START---
{document_text}
---DOCUMENT END---

Based on this document, please answer my question: {user_message}"""

        print(f"🤖 Sending request to Gemini (Model: {MODEL_NAME})...")

        # Create chat session with system instruction
        chat = client.chats.create(
            model=MODEL_NAME,
            config={
                "system_instruction": SYSTEM_INSTRUCTION,
                "max_output_tokens": 1000,
                "temperature": 0.7,
            },
            history=chat_history if chat_history else None,
        )

        # Send message to Gemini
        response = chat.send_message(current_message)

        # Extract the AI's response
        ai_response = response.text

        print(f"✅ Received response from AI ({len(ai_response)} characters)")

        return ai_response

    except Exception as e:
        print(f"❌ Error calling Gemini: {str(e)}")
        return f"❌ Sorry, I encountered an error: {str(e)}\n\nPlease make sure your Gemini API key is valid."


# Initialize app
if __name__ == "__main__":
    app.run(debug=True, port=5000)
