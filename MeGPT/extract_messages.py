import os
import sqlite3
import json
import sys
import tarfile
import tempfile

def extract_messages(phone_number: str) -> list:
    """Extract messages for a given phone number and return them as a list."""
    # Get the user's home directory
    home = os.path.expanduser("~")
    
    # Path to the SQLite database
    db_path = f"{home}/Library/Messages/chat.db"
    
    # SQL query to extract messages
    query = """
    WITH messages_with_prev AS (
        SELECT m.ROWID, m.guid, m.text, m.subject, m.country, m.date, chj.chat_id, m.is_from_me,
               LAG(m.is_from_me) OVER (PARTITION BY chj.chat_id ORDER BY m.date) AS prev_is_from_me
        FROM message AS m
        JOIN chat_message_join AS chj ON m.ROWID = chj.message_id
        JOIN handle h ON m.handle_id = h.ROWID
        WHERE LENGTH(m.text) > 0
        AND h.id = ?  -- Phone number in format: +1234567890
    ),
    grouped_messages AS (
        SELECT *,
               SUM(CASE WHEN is_from_me != IFNULL(prev_is_from_me, -1) THEN 1 ELSE 0 END) OVER (PARTITION BY chat_id ORDER BY date) AS grp
        FROM messages_with_prev
    ),
    consecutive_messages AS (
        SELECT chat_id, is_from_me, group_concat(text, '\n') AS joined_text, MIN(date) AS min_date
        FROM grouped_messages
        GROUP BY chat_id, is_from_me, grp
    ),
    my_consecutive_messages AS (
        SELECT * FROM consecutive_messages WHERE is_from_me = 1
    ),
    other_consecutive_messages AS (
        SELECT * FROM consecutive_messages WHERE is_from_me = 0
    )

    SELECT other.joined_text AS prev_text, my.joined_text AS my_text
            FROM my_consecutive_messages AS my
    LEFT JOIN other_consecutive_messages AS other ON my.chat_id = other.chat_id AND other.min_date < my.min_date
    WHERE other.min_date = (
        SELECT MAX(min_date) FROM other_consecutive_messages AS ocm
        WHERE ocm.chat_id = my.chat_id AND ocm.min_date < my.min_date
    )
    ORDER BY my.min_date;
    """

    # Check if file exists
    if not os.path.exists(db_path):
        raise FileNotFoundError("Messages database not found")

    # Check permissions
    if not os.access(db_path, os.R_OK):
        try:
            os.chmod(db_path, 0o644)
        except PermissionError as e:
            raise PermissionError("Please grant Full Disk Access permission in System Preferences > Security & Privacy > Privacy > Full Disk Access")

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Clean the phone number - remove all non-digit characters except leading +
        clean_number = '+' + ''.join(c for c in phone_number.lstrip('+') if c.isdigit())
        
        # Execute query
        cursor.execute(query, (clean_number,))
        results = cursor.fetchall()
        
        if not results:
            return []
            
        # Process results
        results = [tuple(map(lambda x: x.replace("\n", " ") if x else "", row)) for row in results]
        messages = [{"text": f"person: {row[0]}\nMeGPT: {row[1]}", "label": 0} for row in results]
        
        return messages

    except sqlite3.Error as e:
        raise Exception(f"Database error: {str(e)}")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    # This part only runs when script is executed directly
    phone_number = input("Enter phone number (format: +1234567890): ")
    try:
        messages = extract_messages(phone_number)
        if messages:
            print(f"Found {len(messages)} conversations")
            # Save to JSON
            with open("messages.json", "w") as f:
                json.dump(messages, f, indent=4)
            # Create tar.gz
            with tarfile.open("messages.tar.gz", "w:gz") as tar:
                tar.add("messages.json")
            os.remove("messages.json")
            print("Successfully saved messages to messages.tar.gz")
        else:
            print("No messages found")
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)
