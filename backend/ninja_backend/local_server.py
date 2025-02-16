"""Local server for message extraction."""
import os
import sys
import tempfile
import logging
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from app.message_extractor.extract_messages import extract_messages, get_contacts
from app.message_extractor.generate import get_response, analyze_message_suggestions
from app.api.v1.messages import router
from typing import Optional, List

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class ExportRequest(BaseModel):
    phoneNumber: str

class MessageRequest(BaseModel):
    message: str
    context: dict = {}
    conversation_history: Optional[str] = None
    use_claude: Optional[bool] = True

class Message(BaseModel):
    id: str
    text: str
    isUser: bool
    timestamp: str

class RealChatRequest(BaseModel):
    message: str
    context: dict = {}
    messages: List[Message]

app = FastAPI(title="Ninja Local Server")

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js development
        "http://localhost:5173",  # Vite development (fallback)
        os.getenv("FRONTEND_URL", ""),  # Production frontend
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Include the messages router
app.include_router(router, prefix="/api/v1/messages")

@app.get("/healthz")
async def healthz():
    """Health check endpoint."""
    return {"status": "ok"}

@app.get("/messages")
async def get_messages(contact_id: str | None = None):
    """Get messages endpoint."""
    try:
        messages = extract_messages(contact_id)
        if not messages and contact_id:
            raise HTTPException(
                status_code=404,
                detail=f"No messages found for contact {contact_id}"
            )
        elif not messages:
            raise HTTPException(
                status_code=403,
                detail="Please grant Full Disk Access permission in System Preferences > Security & Privacy > Privacy"
            )
        return {"messages": messages}
    except FileNotFoundError:
        raise HTTPException(
            status_code=403,
            detail="Messages database not accessible. Please grant Full Disk Access permission."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/contacts")
async def list_contacts():
    """List contacts endpoint."""
    try:
        contacts = get_contacts()
        if not contacts:
            raise HTTPException(
                status_code=403,
                detail="Please grant Full Disk Access permission in System Preferences > Security & Privacy > Privacy"
            )
        return {"contacts": contacts}
    except FileNotFoundError:
        raise HTTPException(
            status_code=403,
            detail="Messages database not accessible. Please grant Full Disk Access permission."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list contacts: {str(e)}"
        )

@app.get("/healthz")
async def healthz():
    """Health check endpoint."""
    try:
        # Check if we can access the Messages database
        contacts = get_contacts()
        return {
            "status": "ok",
            "database_accessible": len(contacts) > 0
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

@app.post("/api/v1/messages/export")
async def export_messages(request: ExportRequest):
    """Export messages for a specific phone number."""
    logger.debug(f"Received export request for phone number: {request.phoneNumber}")
    
    try:
        # Clean the phone number for filename
        clean_number = '+' + ''.join(c for c in request.phoneNumber.lstrip('+') if c.isdigit())
        output_file = os.path.join(os.path.expanduser("~/Documents/ninja/messages_data"), f"{clean_number}.tar.gz")
        
        # Run the export script
        messages_data = extract_messages(request.phoneNumber)
        if messages_data is None:
            logger.warning(f"No messages found for phone number: {request.phoneNumber}")
            raise HTTPException(
                status_code=404,
                detail=f"No messages found for phone number {request.phoneNumber}"
            )
        
        # Return the file
        return FileResponse(
            output_file,
            media_type="application/gzip",
            filename=f"{clean_number}.tar.gz",
            background=None  # Prevent async file deletion
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Export failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to export messages: {str(e)}"
        )

@app.post("/api/v1/messages/practice")
async def practice_chat(request: MessageRequest):
    """Practice chat endpoint using Claude as fallback."""
    try:
        response = get_response(
            message=request.message,
            conversation_history=request.conversation_history,
            use_claude=request.use_claude
        )
        
        # Generate suggestions
        suggestions = analyze_message_suggestions(
            request.message,
            request.conversation_history or "",
            request.context.get("goal", "")
        )
        
        return {
            "response": response,
            "feedback": suggestions
        }
    except Exception as e:
        logger.error(f"Practice chat failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get response: {str(e)}"
        )

@app.post("/api/v1/messages/real")
async def real_chat(request: RealChatRequest):
    """Real chat endpoint with message suggestions."""
    try:
        logger.debug(f"Received real chat request: {request.message}")
        
        # Convert conversation history to string format
        conversation_history = "\n".join([
            f"{'User' if msg.isUser else 'Other'}: {msg.text}"
            for msg in request.messages[-5:]  # Only use last 5 messages for context
        ])
        logger.debug(f"Conversation history: {conversation_history}")
        
        # Get suggestions using the model
        suggestions = analyze_message_suggestions(
            request.message,
            conversation_history,
            request.context.get("goal", "")
        )
        logger.debug(f"Generated suggestions: {suggestions}")
        
        return {"feedback": suggestions}
    except Exception as e:
        logger.error(f"Real chat failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get suggestions: {str(e)}"
        )

@app.on_event("startup")
async def startup_event():
    """Log when server starts."""
    logger.debug("Server starting up...")
    try:
        logger.debug("Checking database access...")
        contacts = get_contacts()
        logger.debug(f"Found {len(contacts)} contacts")
    except Exception as e:
        logger.error(f"Database access failed: {e}")

if __name__ == "__main__":
    logger.info("Starting server...")
    # Run in background with hot reload
    uvicorn.run(
        "local_server:app",
        host="127.0.0.1",
        port=3001,
        reload=True,
        reload_dirs=["app"],
        log_level="debug"
    )
