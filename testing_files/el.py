import requests
import os
from dotenv import load_dotenv

# Load env variables from backend/.env
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend', '.env')
load_dotenv(env_path)

SYS_PROMPT = "You are a helpful multilingual assistant. Switch languages automatically when the user speaks in a different language."
VOICE_ID = "EXAVITQu4vLQfsNIu2BZ"
INITIAL_MESSAGE = "Hi! I can speak multiple languages. How can I help?"

def call_someone(phone_number):
    api_key = os.getenv("ELEVENLABS_API_KEY")
    agent_id = os.getenv("AGENT_ID")
    phone_id = os.getenv("PHONE_NUMBER_ID")

    print(f"DEBUG: Loaded env configuration:")
    print(f"  API Key: {'Present' if api_key else 'Missing'} ({api_key[:5]}...)" if api_key else "  API Key: Missing")
    print(f"  Agent ID: {agent_id}")
    print(f"  Phone ID: {phone_id}")
    print(f"  Target Number: {phone_number}")

    if not api_key or not agent_id or not phone_id:
        print("ERROR: Missing required environment variables.")
        return

    print("Sending request to ElevenLabs API...")
    
    try:
        response = requests.post(
            "https://api.elevenlabs.io/v1/convai/twilio/outbound-call",
            headers={"xi-api-key": api_key},
            json={
                "agent_id": agent_id,
                "agent_phone_number_id": phone_id,
                "to_number": phone_number,
                "conversation_initiation_client_data": {
                    "system_prompt": SYS_PROMPT,
                    "initial_message": INITIAL_MESSAGE,
                    "conversation_config_override": {
                        "tts": {
                            "voice_id": VOICE_ID
                        }
                    }
                }
            }
        )
        print(f"Response Status: {response.status_code}")
        print(f"Response Body: {response.text}")
        response.raise_for_status()
        print("Call initiated successfully!")
    except Exception as e:
        print(f"Error making request: {e}")


call_someone("+447466348530")
