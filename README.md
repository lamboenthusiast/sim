# Ninja - AI Chat Practice Tool

Ninja is a one-click fine-tuning tool that helps you practice messaging with AI-powered chat simulations. Train the model on your iMessage history to create personalized chat experiences and receive feedback on your messaging style.

## Features
- One-click iMessage chat export using MeGPT
- AI-powered chat playground with real-time feedback
- Contextual suggestions based on conversation history
- Performance ratings and messaging analysis

## Local Development Setup

### Prerequisites
- Python 3.8+ with pip
- Node.js 18+ with npm
- macOS (for iMessage integration)

### iMessage Export Setup (macOS only)

1. Clone and install MeGPT:
   ```bash
   git clone https://github.com/1rgs/MeGPT.git
   cd MeGPT
   pip install -r requirements.txt
   ```

2. Export your messages:
   ```bash
   python extract_messages.py
   ```

3. The exported messages will be saved as messages.csv and ready for fine-tuning

### Backend Setup
```bash
cd backend/ninja_backend
pip install -r requirements.txt
python -m uvicorn local_server:app --reload --port 3001
```

The backend will be available at http://localhost:3001

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at http://localhost:3000

### Environment Variables

Backend (`.env` in backend/ninja_backend):
```
ANTHROPIC_API_KEY=your_api_key_here
MODEL_PATH=path/to/saved/model  # Optional, for loading pre-trained models
```

Frontend (`.env` in frontend):
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Development Notes

- The frontend is built with Next.js and uses Tailwind CSS for styling
- For hackathon demos, prepare the fine-tuned model in advance
- The chat playground provides real-time feedback and suggestions

## API Documentation

### Message Import
- `POST /api/v1/messages/import` - Import messages from MeGPT export
- `GET /api/v1/messages/{contact}` - Get imported messages for a contact

### Chat Interface
- `POST /api/v1/chat/message` - Send a message and get AI response
- `POST /api/v1/chat/analyze` - Get feedback on messaging style

### Model Management
- `POST /api/v1/model/train` - Fine-tune model on imported messages
- `GET /api/v1/model/status` - Check training status
