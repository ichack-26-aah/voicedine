import requests
import os
import sys
from dotenv import load_dotenv

load_dotenv()

# --- CONFIGURATION (User Values) ---
SYS_PROMPT = "You are a helpful assistant"
VOICE_ID = "EXAVITQu4vLQfsNIu2BZ" # User provided ID
INITIAL_MESSAGE = "Hi! This is your AI assistant. How can I help you today?"

# --- ENV VARIABLES ---
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
AGENT_ID = os.getenv("ELEVENLABS_AGENT_ID") # Corrected env var name
PHONE_NUMBER_ID = os.getenv("ELEVENLABS_PHONE_ID") # Corrected env var name
MY_NUMBER = os.getenv("MY_NUMBER")

if not all([ELEVENLABS_API_KEY, AGENT_ID, PHONE_NUMBER_ID, MY_NUMBER]):
    print(">> Missing environment variables. Check .env")
    sys.exit(1)

def call_someone(phone_number, system_prompt=SYS_PROMPT):
    print(f">> Dialing {phone_number}...")
    print(f">> Voice ID: {VOICE_ID}")
    
    try:
        response = requests.post(
            "https://api.elevenlabs.io/v1/convai/twilio/outbound-call",
            headers={"xi-api-key": ELEVENLABS_API_KEY},
            json={
                "agent_id": AGENT_ID,
                "agent_phone_number_id": PHONE_NUMBER_ID,
                "to_number": phone_number,
                
                # Adapted structure for correct API usage
                "conversation_initiation_client_data": {
                    "conversation_config_override": {
                        "agent": {
                            "prompt": {
                                "prompt": system_prompt
                            },
                            # "first_message": INITIAL_MESSAGE, # Commented out to prevent talking over "Press any key" trial prompt
                        },
                        "tts": {
                            "voice_id": VOICE_ID
                        }
                    }
                }
            }
        )
        
        if response.status_code == 200:
            print(f">> SUCCESS: {response.json()}")
        else:
            print(f">> ERROR {response.status_code}: {response.text}")
            
    except Exception as e:
        print(f">> CRITICAL ERROR: {e}")

if __name__ == "__main__":
    call_someone(MY_NUMBER)
