from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import os
import json
from werkzeug.utils import secure_filename
import PyPDF2
import requests
from openai import OpenAI

# Loading environment variables
load_dotenv()

# APP SETUP
app = Flask(__name__)

# Configuration
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max
app.config['UPLOAD_FOLDER'] = 'uploads'

# Create uploads folder
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Get API keys from environment
OCR_API_KEY = os.getenv('OCR_SPACE_API_KEY')
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
MODEL_NAME = os.getenv('MODEL_NAME', 'meta-llama/llama-3.1-8b-instruct:free')

# Initialize OpenRouter client (uses OpenAI library but points to OpenRouter)
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
)

# ROUTE: Homepage
@app.route('/')
def home():
    return render_template('index.html')

# ROUTE: Handle Chat Messages
@app.route('/chat', methods=['POST'])
def chat():
    """Handles incoming chat messages and file uploads"""
    
    try:
        # Get data from request
        user_message = request.form.get('message', '')
        conversation_history = json.loads(request.form.get('conversation_history', '[]'))
        
        # Check for uploaded file
        uploaded_file = request.files.get('file')
        file_type = request.form.get('file_type')
        
        extracted_text = None
        
        # Process file if present
        if uploaded_file and file_type:
            filename = secure_filename(uploaded_file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            uploaded_file.save(filepath)
            
            print(f"📁 Processing {file_type}: {filename}")
            
            # Extract text based on file type
            if file_type == 'pdf':
                extracted_text = extract_text_from_pdf(filepath)
            elif file_type == 'image':
                extracted_text = extract_text_from_image(filepath)
            
            # Clean up temporary file
            os.remove(filepath)
            
            if extracted_text:
                print(f"✅ Extracted {len(extracted_text)} characters")
        
        # Get AI response from OpenRouter
        bot_response = get_ai_response(
            user_message, 
            conversation_history, 
            extracted_text
        )
        
        # Update conversation history
        conversation_history.append({
            'role': 'user',
            'content': user_message
        })
        conversation_history.append({
            'role': 'assistant',
            'content': bot_response
        })
        
        return jsonify({
            'success': True,
            'response': bot_response,
            'conversation_history': conversation_history
        })
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        })

# Extract Text from PDF
def extract_text_from_pdf(filepath):
    """Extracting text from PDF using PyPDF2"""
    
    try:
        text = ""
        
        with open(filepath, 'rb') as file:
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
        url = 'https://api.ocr.space/parse/image'
        
        with open(filepath, 'rb') as image_file:
            payload = {
                'apikey': OCR_API_KEY,
                'language': 'eng',
                'isOverlayRequired': False,
                'detectOrientation': True,
                'scale': True,
                'OCREngine': 2,
            }
            
            files = {
                'filename': image_file
            }
            
            print(f"🖼️ Sending image to OCR.space...")
            
            response = requests.post(url, data=payload, files=files)
            result = response.json()
            
            if result.get('OCRExitCode') == 1:
                parsed_text = result.get('ParsedResults', [{}])[0].get('ParsedText', '')
                
                if parsed_text.strip():
                    print(f"✅ Successfully extracted text from image")
                    return parsed_text.strip()
                else:
                    return "⚠️ No text detected in this image. Make sure the image contains clear, readable text."
            else:
                error_message = result.get('ErrorMessage', ['Unknown error'])[0]
                return f"❌ OCR Error: {error_message}"
                
    except Exception as e:
        print(f"Error with OCR.space API: {str(e)}")
        return f"❌ Error processing image: {str(e)}"

# FUNCTION: Get AI Response from OpenRouter
def get_ai_response(user_message, conversation_history, document_text=None):
    """
    Get AI response from OpenRouter
    
    Args:
        user_message: The user's current question
        conversation_history: Previous messages in the conversation
        document_text: Text extracted from uploaded document (if any)
    
    Returns:
        AI-generated response as a string
    """
    
    try:
        # Build the system message (instructions for the AI)
        system_message = """You are a helpful study assistant. Your purpose is to help students understand their study materials and answer their questions.

Guidelines:
- If a document is provided, answer questions based primarily on that document
- Give clear, concise explanations suitable for students
- If you don't know something, say so honestly
- Be encouraging and supportive
- Break down complex topics into simple terms
- Use examples when helpful"""

        # Start building the messages array for OpenRouter
        messages = [
            {"role": "system", "content": system_message}
        ]
        
        # Add conversation history (so AI remembers context)
        for msg in conversation_history:
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
        
        # Build the current user message
        current_message = user_message
        
        # If there's a document, prepend it to the message
        if document_text:
            current_message = f"""I have uploaded a document. Here is its content:

---DOCUMENT START---
{document_text}
---DOCUMENT END---

Based on this document, please answer my question: {user_message}"""
        
        # Add the current user message
        messages.append({
            "role": "user",
            "content": current_message
        })
        
        print(f"🤖 Sending request to OpenRouter (Model: {MODEL_NAME})...")
        
        # Call OpenRouter API
        response = client.chat.completions.create(
            model=MODEL_NAME, 
            messages=messages,
            max_tokens=1000,  # Limit response length
            temperature=0.7,  # Balance between creative and focused
        )
        
        # Extract the AI's response
        ai_response = response.choices[0].message.content
        
        print(f"✅ Received response from AI ({len(ai_response)} characters)")
        
        return ai_response
        
    except Exception as e:
        print(f"❌ Error calling OpenRouter: {str(e)}")
        return f"❌ Sorry, I encountered an error: {str(e)}\n\nPlease make sure your OpenRouter API key is valid and you have access to free models."

# Initialize app
if __name__ == '__main__':
    app.run(debug=True, port=5000)
