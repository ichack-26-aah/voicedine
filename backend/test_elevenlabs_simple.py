import requests
import os
from dotenv import load_dotenv

load_dotenv()

def call_someone(phone_number, restaurant_name):
    # Map env vars to what the script expects
    api_key = os.getenv("ELEVENLABS_API_KEY")
    agent_id = os.getenv("ELEVENLABS_AGENT_ID")
    phone_id = os.getenv("ELEVENLABS_PHONE_ID")

    print(f">> Dialing {phone_number} via ElevenLabs to call '{restaurant_name}'...")

    if not all([api_key, agent_id, phone_id, phone_number]):
        print("Missing keys! Check .env")
        return

    try:
        response = requests.post(
            "https://api.elevenlabs.io/v1/convai/twilio/outbound-call",
            headers={"xi-api-key": api_key},
            json={
                "agent_id": agent_id,
                "agent_phone_number_id": phone_id,
                "to_number": phone_number,
                "conversation_initiation_client_data": {
                    "conversation_config_override": {
                        "agent": {
                            "prompt": {
                                "prompt": f"You are a helpful assistant, that is booking a restaurant booking/ ordering food from this restaurant in a native language of our choice. The agent should receive input. This is the restaurant you booked: {restaurant_name}"
                            },
                            "first_message": f"Hello, is this {restaurant_name}?",
                            "language": "en" # Forces English model
                        },
                        "tts": {
                            "voice_id": "21m00Tcm4TlvDq8ikWAM" # "Rachel" - Standard US Female
                        }
                    }
                }
            }
        )
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

# Call it using the configured MY_NUMBER
my_number = os.getenv("MY_NUMBER")
if my_number:
    call_someone(my_number, "Nando's")
else:
    print("MY_NUMBER not set in .env")
