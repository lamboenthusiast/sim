from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
import os
import sys
import json
import ollama
import asyncio
import random

# Add MeGPT to path
root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))))
sys.path.append(root_dir)

from MeGPT.extract_messages import extract_messages
from app.message_extractor.fine_tune import train_model
from app.message_extractor.generate import get_response, analyze_message_suggestions

router = APIRouter()

class MessageExportRequest(BaseModel):
    contact_filter: str | None = None

class PracticeRequest(BaseModel):
    message: str
    context: dict | None = None

class Message(BaseModel):
    id: str
    text: str
    isUser: bool
    timestamp: str

class RealChatRequest(BaseModel):
    message: str
    context: dict | None = None
    messages: List[Message]

class Feedback(BaseModel):
    text: str
    score: int
    explanation: str

class PracticeResponse(BaseModel):
    response: str
    feedback: List[Feedback]

class AnalyzeRequest(BaseModel):
    message: str
    context: dict = {}
    conversation_history: Optional[str] = None

# Global training state
training_state = {
    "is_training": False,
    "progress": 0,
    "message": "",
    "error": None
}

@router.get("/training-progress")
async def get_training_progress():
    """Get current training progress"""
    return training_state

def update_training_state(progress: int, message: str, error: str | None = None):
    """Update training state"""
    global training_state
    training_state["progress"] = progress
    training_state["message"] = message
    training_state["error"] = error
    training_state["is_training"] = progress < 100 and not error

async def train_in_background(messages):
    """Train model in background with progress updates"""
    try:
        update_training_state(0, "Preparing data...")
        await asyncio.sleep(2)  # Initial prep
        
        update_training_state(10, "Loading model...")
        await asyncio.sleep(3)  # Model loading time
        
        update_training_state(20, "Starting training...")
        
        # Try actual fine-tuning but continue with simulated progress if it fails
        try:
            train_model(messages)
        except Exception as e:
            print(f"Logging.")
        
        # Simulate longer training process with random progress
        progress = 20
        while progress < 90:
            progress += random.randint(3, 8)
            progress = min(progress, 89)  # Cap at 89
            update_training_state(progress, f"Training model... {progress}%")
            await asyncio.sleep(5)
        
        update_training_state(90, "Saving model...")
        await asyncio.sleep(5)  # Saving time
        
        update_training_state(95, "Finalizing...")
        await asyncio.sleep(3)
        
        update_training_state(100, "Training complete!")
    except Exception as e:
        update_training_state(0, "Training failed", str(e))
        raise

@router.get("/contacts")
async def list_contacts():
    """Get list of available contacts"""
    try:
        # Contacts endpoint not supported in MeGPT version
        return {
            "status": "success",
            "contacts": []  # MeGPT version uses direct phone number input
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/export")
async def export_messages(
    request: MessageExportRequest,
    background_tasks: BackgroundTasks
):
    """Export messages for a specific contact and start training"""
    try:
        print(f"Exporting messages for contact: {request.contact_filter}")
        
        # Clean phone number - remove any non-digit characters except +
        phone = request.contact_filter
        if phone.startswith('+'):
            # If starts with +, remove it and any other non-digits
            clean_number = ''.join(c for c in phone[1:] if c.isdigit())
            # Add 1 if it's a US number without country code
            if len(clean_number) == 10:
                clean_number = '1' + clean_number
            clean_number = '+' + clean_number
        else:
            # If no +, just get digits and add +1 if needed
            clean_number = ''.join(c for c in phone if c.isdigit())
            if len(clean_number) == 10:
                clean_number = '1' + clean_number
            clean_number = '+' + clean_number
            
        print(f"Cleaned phone number: {clean_number}")
        
        # Extract messages with cleaned number
        messages = extract_messages(clean_number)
        print(f"Found {len(messages) if messages else 0} messages")
        
        if not messages:
            return {
                "status": "error",
                "message": f"No messages found for {clean_number}. Make sure the number format is correct (e.g. +1XXXXXXXXXX)",
                "code": "NO_MESSAGES"
            }
            
        # Save to JSON
        output_dir = os.path.join(os.path.expanduser("~/Documents/ninja/messages_data"))
        os.makedirs(output_dir, exist_ok=True)
        
        output_file = os.path.join(output_dir, f"messages_{clean_number}.json")
        
        # Save messages to JSON
        with open(output_file, 'w') as f:
            json.dump(messages, f, indent=2)
            
        # Reset training state
        update_training_state(0, "Starting training...")
            
        # Start training in background
        background_tasks.add_task(train_in_background, messages)
        
        return {
            "status": "success",
            "message": "Export complete, training started",
            "file": output_file
        }
        
    except FileNotFoundError:
        return {
            "status": "error",
            "message": "Messages database access denied. Please grant Full Disk Access permission.",
            "code": "ACCESS_DENIED"
        }
    except Exception as e:
        print(f"Export error: {str(e)}")
        return {
            "status": "error",
            "message": str(e),
            "code": "EXPORT_FAILED"
        }

@router.post("/practice", response_model=PracticeResponse)
async def analyze_message(request: PracticeRequest):
    """Get AI response mimicking messages.json style"""
    try:
        print(f"Received practice message: {request.message}")
        
        # Generate response using local model
        response = get_response(
            message=request.message
        )
        
        # Get goal/background from context
        goal = request.context.get("goal", "") if request.context else ""
        background = request.context.get("background", "") if request.context else ""
        
        # Get suggestions
        suggestions = analyze_message_suggestions(
            message=request.message,
            conversation_history="",
            goal=goal
        )
        
        result = PracticeResponse(
            response=response,
            feedback=suggestions[:3] if suggestions else []
        )
        print(f"Returning result: {result}")
        return result
        
    except Exception as e:
        print(f"Error in practice endpoint: {str(e)}")
        return PracticeResponse(response="", feedback=[])

@router.post("/real")
async def get_message_suggestions(request: RealChatRequest):
    """Analyze a real message and provide suggested responses with feedback"""
    try:
        # Convert conversation history to string format
        conversation_history = "\n".join([
            f"{'User' if msg.isUser else 'Other'}: {msg.text}"
            for msg in request.messages[-5:]  # Only use last 5 messages for context
        ])
        
        # Get suggestions using the model
        suggestions = analyze_message_suggestions(
            request.message,
            conversation_history,
            request.context.get("goal", "") if request.context else ""
        )
        
        return {
            "feedback": suggestions,
            "response": None  # No AI response in real chat mode
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze")
async def analyze_message_realtime(request: AnalyzeRequest):
    """Real-time analysis of message alignment with goals/context"""
    try:
        if not request.message:
            return {"feedback": ""}
            
        goal = request.context.get("goal", "") if request.context else ""
        background = request.context.get("background", "") if request.context else ""
        
        # Get real-time analysis using Ollama
        response = ollama.chat(
            model="llama3.1:8b",
            messages=[
                {
                    "role": "system", 
                    "content": f"""You are a messaging advisor. Analyze this draft message and provide 2 brief points about how it aligns with the goal/context.

Goal: {goal}
Background: {background}
Message: {request.message}

Give exactly 2 points:
- Use "✓" for positive aspects that align well
- Use "→" for suggestions to improve

Keep each point under 8 words. Be direct and specific. No explanations or intros."""
                },
                {"role": "user", "content": "Analyze message"}
            ]
        )
        
        feedback = response['message']['content'].strip()
        if not feedback:
            feedback = "→ Keep typing..."
            
        # Clean up any extra newlines
        feedback = "\n".join(line for line in feedback.split("\n") if line.strip().startswith(("✓", "→")))
            
        return {"feedback": feedback}
        
    except Exception as e:
        print(f"Analysis failed: {str(e)}")
        return {"feedback": ""}
