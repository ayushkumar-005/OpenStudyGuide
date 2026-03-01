# OpenStudyGuide

A study-assistant web app that lets you upload PDFs or images, perform OCR text extraction, interact with your material via chat, and export your sessions.

Live demo: https://openstudyguide.onrender.com/

## Features

- 📄 **Document Upload**: Upload PDF or image files (e.g., handwritten notes, scanned slides) and extract text using OCR
- 🤖 **AI-Powered Chat**: Chat with your uploaded content using Google Gemini AI - ask questions, get explanations, and engage in follow-up interactions
- 💾 **Export Conversations**: Export your conversation or derived study notes for review or offline storage
- 🎨 **Simple Interface**: Intuitive web interface — no heavy setup needed for everyday use
- 🔒 **Secure**: Your data stays local, only text is sent to APIs for processing
- 📱 **Responsive**: Works on desktop and mobile devices

## Tech Stack

**Frontend:** HTML, CSS, JavaScript

**Backend:** Python (Flask)

**AI & APIs:**

- [Google Gemini API](https://ai.google.dev/) - Powered by `gemini-2.5-flash` model
- [OCR Space API](https://ocr.space/ocrapi) - For text extraction from images

**Python Package:** `google-genai` (Modern, officially supported package)

**Hosting:** [Render](https://render.com/)

## Prerequisites

- Python 3.8 or higher
- Google Gemini API key ([Get it free here](https://makersuite.google.com/app/apikey))
- OCR Space API key ([Get it free here](https://ocr.space/ocrapi))

## Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/ayushkumar-005/OpenStudyGuide.git
cd OpenStudyGuide
```

### 2. Create Virtual Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate

# On Windows:
venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Required: Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Required: OCR Space API Key
OCR_SPACE_API_KEY=your_ocr_api_key_here

# Optional: Model selection (defaults to gemini-2.5-flash)
MODEL_NAME=gemini-2.5-flash
```

### 5. Run the Application

```bash
python app.py
```

The app will be available at `http://localhost:5000`

## Project Structure

```
OpenStudyGuide/
│
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── .env                   # Environment variables (create this)
├── .gitignore            # Git ignore file
├── README.md             # This file
│
├── templates/
│   └── index.html        # Main HTML template
│
├── static/
│   ├── css/              # Stylesheets
│   ├── js/               # JavaScript files
│   └── images/           # Image assets
│
└── uploads/              # Temporary upload directory (auto-created)
```

## How It Works

1. **Document Upload**: Users upload PDF or image files through the web interface
2. **Text Extraction**:
    - PDFs: Text is extracted using PyPDF2
    - Images: Text is extracted using OCR Space API
3. **AI Processing**: The extracted text is sent to Google Gemini AI along with the user's question
4. **Response Generation**: Gemini generates a contextual response based on the document content
5. **Conversation History**: The chat maintains context for follow-up questions

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- Google Gemini AI for providing powerful language understanding
- OCR Space for free OCR API access
