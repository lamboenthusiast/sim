import os
import sqlite3
import json
import tarfile
import tempfile
import logging

logger = logging.getLogger(__name__)

# Add output directory configuration
OUTPUT_DIR = os.path.expanduser("~/Documents/ninja/messages_data")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def get_contacts():
    """Get list of contacts from the database."""
    home = os.path.expanduser("~")
    db_path = f"{home}/Library/Messages/chat.db"

    if not os.access(db_path, os.R_OK):
        try:
            os.chmod(db_path, 0o644)
        except PermissionError as e:
            print(f"Permission Error: {e}")
            print(
                "Please go to System Preferences > Security & Privacy > Privacy > Full Disk Access"
            )
            return []

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT DISTINCT id FROM handle WHERE service='iMessage'")
    contacts = [row[0] for row in cursor.fetchall()]
    conn.close()
    
    return contacts

def extract_messages(phone_number=None):
    """Extract messages from the database."""
    logger.debug(f"Starting message extraction for phone number: {phone_number}")
    home = os.path.expanduser("~")
    db_path = f"{home}/Library/Messages/chat.db"

    if not os.access(db_path, os.R_OK):
        try:
            os.chmod(db_path, 0o644)
        except PermissionError as e:
            logger.error(f"Permission error accessing database: {e}")
            return None

    # Clean the phone number for filename
    clean_number = ''.join(c for c in phone_number.lstrip('+') if c.isdigit()) if phone_number else 'all'
    output_file = os.path.join(OUTPUT_DIR, f"{clean_number}.tar.gz")
    
    logger.debug("Creating temporary directory")
    with tempfile.TemporaryDirectory() as temp_dir:
        messages_json = os.path.join(temp_dir, "messages.json")
        
        logger.debug("Connecting to database")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Base query
        query = """
        WITH messages_with_prev AS (
            SELECT m.ROWID, m.guid, m.text, m.subject, m.country, m.date, chj.chat_id, m.is_from_me,
                   LAG(m.is_from_me) OVER (PARTITION BY chj.chat_id ORDER BY m.date) AS prev_is_from_me
            FROM message AS m
            JOIN chat_message_join AS chj ON m.ROWID = chj.message_id
            JOIN handle h ON m.handle_id = h.ROWID
            WHERE LENGTH(m.text) > 0
            AND h.id = ?
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

        try:
            logger.debug("Executing query")
            if phone_number:
                logger.debug(f"Using phone number filter: {clean_number}")
                cursor.execute(query, (clean_number,))
            else:
                cursor.execute(query)
            
            results = cursor.fetchall()
            logger.debug(f"Found {len(results) if results else 0} results")
            
            if not results:
                logger.debug("No results found")
                return None
            
            logger.debug("Processing results")
            results = [tuple(map(lambda x: x.replace("\n", " ") if x else "", row)) for row in results]
            
            logger.debug("Saving to JSON")
            with open(messages_json, "w") as f:
                json.dump(
                    [{"text": f"person: {row[0]}\nMeGPT: {row[1]}", "label": 0} for row in results],
                    f,
                    indent=4,
                )
            
            logger.debug(f"Creating tar.gz file at {output_file}")
            with tarfile.open(output_file, "w:gz") as tar:
                tar.add(messages_json, arcname="messages.json")
            
            logger.debug("Reading tar.gz file")
            with open(output_file, "rb") as f:
                return f.read()
                
        except Exception as e:
            logger.error(f"Error during message extraction: {str(e)}", exc_info=True)
            raise
        finally:
            conn.close()

if __name__ == "__main__":
    # Test the functions
    contacts = get_contacts()
    print(f"Found {len(contacts)} contacts")
    if contacts:
        print("First few contacts:", contacts[:5])
