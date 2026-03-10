import json
import os

import PyPDF2
import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from google import genai
from werkzeug.utils import secure_filename

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configuration
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB max upload size
app.config["UPLOAD_FOLDER"] = "uploads"

# Ensure uploads folder exists
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

# Environment variables
OCR_API_KEY = os.getenv("OCR_SPACE_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = os.getenv("MODEL_NAME", "gemini-2.5-flash")

SYSTEM_INSTRUCTION = """You are a helpful study assistant. Your purpose is to help students understand their study materials and answer their questions.

Guidelines:
- If a document is provided, answer questions based primarily on that document
- Give clear, concise explanations suitable for students
- If you don't know something, say so honestly
- Be encouraging and supportive
- Break down complex topics into simple terms
- Use examples when helpful
"""


def get_gemini_client():
    """Create Gemini client only when needed, not during app startup."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set")
    return genai.Client(api_key=GEMINI_API_KEY)


@app.route("/", methods=["GET"])
def home():
    return render_template("index.html")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


@app.route("/chat", methods=["POST"])
def chat():
    """Handle incoming chat messages and file uploads."""
    filepath = None

    try:
        user_message = request.form.get("message", "").strip()

        raw_history = request.form.get("conversation_history", "[]")
        try:
            conversation_history = json.loads(raw_history)
            if not isinstance(conversation_history, list):
                conversation_history = []
        except json.JSONDecodeError:
            conversation_history = []

        uploaded_file = request.files.get("file")
        file_type = request.form.get("file_type")

        extracted_text = None

        if uploaded_file and file_type:
            filename = secure_filename(uploaded_file.filename or "")

            if not filename:
                return jsonify({"success": False, "error": "Invalid uploaded file."}), 400

            filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            uploaded_file.save(filepath)

            app.logger.info("Processing %s: %s", file_type, filename)

            if file_type == "pdf":
                extracted_text = extract_text_from_pdf(filepath)
            elif file_type == "image":
                extracted_text = extract_text_from_image(filepath)
            else:
                return jsonify({"success": False, "error": "Unsupported file type."}), 400

            if extracted_text:
                app.logger.info("Extracted %s characters", len(extracted_text))

        bot_response = get_ai_response(
            user_message=user_message,
            conversation_history=conversation_history,
            document_text=extracted_text,
        )

        conversation_history.append({"role": "user", "content": user_message})
        conversation_history.append({"role": "assistant", "content": bot_response})

        return jsonify(
            {
                "success": True,
                "response": bot_response,
                "conversation_history": conversation_history,
            }
        ), 200

    except Exception as e:
        app.logger.exception("Error in /chat")
        return jsonify({"success": False, "error": str(e)}), 500

    finally:
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
            except OSError:
                app.logger.warning("Could not delete temp file: %s", filepath)


def extract_text_from_pdf(filepath):
    """Extract text from PDF using PyPDF2."""
    try:
        text = ""

        with open(filepath, "rb") as file:
            pdf_reader = PyPDF2.PdfReader(file)
            num_pages = len(pdf_reader.pages)

            app.logger.info("PDF has %s pages", num_pages)

            for page in pdf_reader.pages:
                page_text = page.extract_text() or ""
                text += page_text + "\n\n"

        if not text.strip():
            return (
                "⚠️ This PDF appears to be image-based. "
                "Try converting it to text first or use an image upload."
            )

        return text.strip()

    except Exception as e:
        app.logger.exception("Error extracting PDF")
        return f"❌ Error reading PDF: {str(e)}"


def extract_text_from_image(filepath):
    """Extract text from image using OCR.space API."""
    try:
        if not OCR_API_KEY:
            return "❌ OCR_SPACE_API_KEY is not set."

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

            app.logger.info("Sending image to OCR.space")

            response = requests.post(url, data=payload, files=files, timeout=60)
            response.raise_for_status()
            result = response.json()

            if result.get("OCRExitCode") == 1:
                parsed_text = result.get("ParsedResults", [{}])[0].get("ParsedText", "")

                if parsed_text.strip():
                    app.logger.info("Successfully extracted text from image")
                    return parsed_text.strip()

                return (
                    "⚠️ No text detected in this image. "
                    "Make sure the image contains clear, readable text."
                )

            error_message = result.get("ErrorMessage", ["Unknown error"])
            if isinstance(error_message, list):
                error_message = error_message[0] if error_message else "Unknown error"

            return f"❌ OCR Error: {error_message}"

    except Exception as e:
        app.logger.exception("Error with OCR.space API")
        return f"❌ Error processing image: {str(e)}"


def get_ai_response(user_message, conversation_history, document_text=None):
    """
    Get AI response from Gemini.

    Args:
        user_message: Current user question
        conversation_history: Previous conversation messages
        document_text: Extracted document text, if any

    Returns:
        AI-generated response string
    """
    try:
        client = get_gemini_client()

        chat_history = []

        for msg in conversation_history:
            role = "user" if msg.get("role") == "user" else "model"
            content = msg.get("content", "")
            chat_history.append({"role": role, "parts": [{"text": content}]})

        current_message = user_message

        if document_text:
            current_message = f"""I have uploaded a document. Here is its content:

---DOCUMENT START---
{document_text}
---DOCUMENT END---

Based on this document, please answer my question: {user_message}"""

        app.logger.info("Sending request to Gemini (Model: %s)", MODEL_NAME)

        chat = client.chats.create(
            model=MODEL_NAME,
            config={
                "system_instruction": SYSTEM_INSTRUCTION,
                "max_output_tokens": 1000,
                "temperature": 0.7,
            },
            history=chat_history if chat_history else None,
        )

        response = chat.send_message(current_message)
        ai_response = response.text or "Sorry, I could not generate a response."

        app.logger.info("Received response from AI (%s characters)", len(ai_response))

        return ai_response

    except Exception as e:
        app.logger.exception("Error calling Gemini")
        return (
            f"❌ Sorry, I encountered an error: {str(e)}\n\n"
            "Please make sure your Gemini API key is valid."
        )


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=True,
    )