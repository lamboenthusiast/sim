import os
import json
from typing import Optional
import ollama
import glob
from functools import lru_cache

def get_latest_messages_file():
    """Get the most recent messages file from messages_data directory"""
    messages_dir = os.path.expanduser("~/Documents/ninja/messages_data")
    if not os.path.exists(messages_dir):
        return None
        
    # Get all messages_*.json files
    message_files = glob.glob(os.path.join(messages_dir, "messages_*.json"))
    if not message_files:
        return None
        
    # Return most recently modified file
    return max(message_files, key=os.path.getmtime)

@lru_cache(maxsize=1)
def load_context(messages_file: Optional[str] = None) -> str:
    """Load and format messages for context"""
    if messages_file is None:
        messages_file = get_latest_messages_file()
        
    print(f"Attempting to load messages from: {messages_file}")
    if messages_file and os.path.exists(messages_file):
        print(f"Found messages file at {messages_file}")
        with open(messages_file, 'r') as f:
            messages = json.load(f)
            print(f"Loaded {len(messages)} messages")
            # Format messages into clear examples
            examples = []
            for msg in messages:
                if "text" in msg:
                    # Split into person/MeGPT parts
                    parts = msg["text"].split("\n")
                    if len(parts) == 2:
                        person = parts[0].replace("person: ", "")
                        megpt = parts[1].replace("MeGPT: ", "")
                        examples.append(f"Them: {person}\nYou: {megpt}")
            print(f"Formatted {len(examples)} examples")
            print("\nExample messages to copy style from:")
            for i, ex in enumerate(examples[-2:], 1):  # Show last 2 examples
                print(f"\nExample {i}:\n{ex}")
            # Return last 5 examples to stay within context
            final_context = "\n\n".join(examples[-5:])
            return final_context
    else:
        print(f"WARNING: No messages file found")
    return ""

MODEL_NAME = "llama3.1:8b"
print(f"Using Ollama with {MODEL_NAME}...")

def get_response(message: str, conversation_history: Optional[str] = None) -> str:
    """Get response using Ollama."""
    try:
        # Format prompt with context
        context = load_context()
        if not context:
            print("WARNING: No context loaded from messages.json")
            return "Error: No message history available for style matching"
            
        # Format examples for better context understanding
        system_prompt = {
            "role": "system",
            "content": """You are simulating a specific person's texting style based on their message history.
            
CONTEXT STRUCTURE:
Each example is formatted as:
Them: [what others say]
You: [how the person responds]

CRITICAL RULES:
1. Study and copy their EXACT style:
   - Capitalization patterns
   - Punctuation usage
   - Message length
   - Slang/abbreviations
   - Emoji usage (only if in examples)
2. NEVER mention being AI
3. NEVER explain or be meta
4. NEVER give long responses unless examples show long responses
5. Stay 100% in character"""
        }

        # Build conversation context
        context_messages = [
            system_prompt,
            {
                "role": "user",
                "content": "Here are the person's actual text messages. Study their style carefully:"
            },
            {
                "role": "assistant", 
                "content": "I'll analyze their exact texting patterns."
            },
            {
                "role": "user",
                "content": context
            }
        ]

        # Add conversation history if available
        if conversation_history:
            context_messages.extend([
                {
                    "role": "user",
                    "content": "Recent conversation context:"
                },
                {
                    "role": "assistant",
                    "content": conversation_history
                }
            ])

        # Add current message
        context_messages.append({
            "role": "user",
            "content": f"Respond to this message: {message}"
        })

        print("\nSending context to Ollama:")
        for msg in context_messages:
            print(f"\n{msg['role']}: {msg['content'][:100]}...")

        # Generate response using Ollama
        response = ollama.chat(
            model=MODEL_NAME,
            messages=context_messages
        )
        
        result = response['message']['content'].strip()
        print(f"\nOllama response: {result}")
        return result

    except Exception as e:
        print(f"Error generating response: {str(e)}")
        return "Sorry, I had trouble generating a response"

def analyze_message_suggestions(message: str, conversation_history: str, goal: str = "") -> list:
    """Generate and analyze potential response suggestions."""
    try:
        context = load_context()
        if not context:
            print("WARNING: No context loaded")
            return []

        # Build context messages
        context_messages = [
            {
                "role": "system",
                "content": f"""You are analyzing a text message conversation and suggesting responses.
Goal: {goal if goal else 'Have a natural conversation'}

Your task is to suggest 3 possible responses that:
1. Match the exact texting style from the examples
2. Are appropriate for the current conversation
3. Help achieve the goal

Format each suggestion as:
Score: [6-10]
Message: [your suggested text]
Explanation: [1 line about style/goal match]"""
            },
            {
                "role": "user",
                "content": "Here are example messages showing the texting style:"
            },
            {
                "role": "assistant",
                "content": "I'll analyze the style patterns."
            },
            {
                "role": "user",
                "content": context
            }
        ]

        # Add conversation history if available and non-empty
        if conversation_history and conversation_history.strip():
            context_messages.extend([
                {
                    "role": "user",
                    "content": "Recent messages in the conversation:"
                },
                {
                    "role": "assistant",
                    "content": conversation_history
                }
            ])

        # Add current message
        context_messages.append({
            "role": "user",
            "content": f"""Message to respond to: {message}

Generate exactly 3 suggestions that match the texting style and goal.
Use Score/Message/Explanation format.
Separate suggestions with double newlines."""
        })

        # Generate suggestions using Ollama
        print("Generating suggestions...")
        response = ollama.chat(
            model=MODEL_NAME,
            messages=context_messages
        )
        
        suggestions_text = response['message']['content'].strip()
        print(f"Raw suggestions:\n{suggestions_text}")
        suggestions = []
        
        # Parse suggestions
        blocks = suggestions_text.split("\n\n")
        for block in blocks:
            try:
                lines = block.strip().split("\n")
                if len(lines) >= 3:
                    score = int(lines[0].replace("Score:", "").strip())
                    message = lines[1].replace("Message:", "").strip()
                    explanation = lines[2].replace("Explanation:", "").strip()
                    
                    if score >= 6 and message:  # Only include valid suggestions
                        suggestions.append({
                            "text": message,
                            "score": score,
                            "explanation": explanation
                        })
            except Exception as e:
                print(f"Failed to parse suggestion block: {e}")
                continue
                
        print(f"Generated {len(suggestions)} valid suggestions")
        return suggestions[:3]  # Return top 3 suggestions

    except Exception as e:
        print(f"Error generating suggestions: {str(e)}")
        return []
