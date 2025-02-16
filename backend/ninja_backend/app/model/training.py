from app.message_extractor.fine_tune import train_model
from app.message_extractor.generate import chat_with_model

async def train_on_messages(messages):
    """Train model on extracted messages"""
    return await train_model(messages)

async def generate_response(message: str, context: dict | None = None):
    """Generate response using fine-tuned model"""
    return await chat_with_model(message, context or {})
