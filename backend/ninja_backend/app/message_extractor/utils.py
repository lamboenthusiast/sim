"""Utility functions for message extraction and model training."""
import os
import sqlite3
from typing import List, Dict, Optional

def sanitize_message(text: str) -> str:
    """Clean message text for training."""
    if not text:
        return ""
    
    # Remove special characters but keep basic punctuation
    text = text.replace("\x00", "")
    
    # Normalize whitespace
    text = " ".join(text.split())
    
    return text

def format_conversation(messages: List[Dict]) -> List[str]:
    """Format messages into conversation pairs for training."""
    conversation_pairs = []
    
    for i in range(len(messages) - 1):
        if messages[i]["is_from_me"] != messages[i + 1]["is_from_me"]:
            prompt = sanitize_message(messages[i]["text"])
            response = sanitize_message(messages[i + 1]["text"])
            
            if prompt and response:
                conversation_pairs.append({
                    "prompt": prompt,
                    "response": response,
                    "is_response_from_me": messages[i + 1]["is_from_me"]
                })
    
    return conversation_pairs
