import requests
import json
import os
import sys
from dotenv import load_dotenv

# Load env vars from .env file
load_dotenv()

# --- LOAD FROM ENV ---
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
AGENT_ID = os.getenv("ELEVENLABS_AGENT_ID")          # Corrected to match .env
PHONE_NUMBER_ID = os.getenv("ELEVENLABS_PHONE_ID")   # Corrected to match .env
MY_NUMBER = os.getenv("MY_NUMBER")

# --- SAFETY CHECK ---
if not all([ELEVENLABS_API_KEY, AGENT_ID, PHONE_NUMBER_ID, MY_NUMBER]):
    print(">> Yo fam, you're missing environment variables.")
    print(f">> ELEVENLABS_API_KEY: {'[SET]' if ELEVENLABS_API_KEY else '[MISSING]'}")
    print(f">> AGENT_ID: {'[SET]' if AGENT_ID else '[MISSING]'}")
    print(f">> PHONE_NUMBER_ID: {'[SET]' if PHONE_NUMBER_ID else '[MISSING]'}")
    print(f">> MY_NUMBER: {'[SET]' if MY_NUMBER else '[MISSING]'}")
    print(">> Make sure you set ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, ELEVENLABS_PHONE_ID, and MY_NUMBER in .env")
    sys.exit(1)

def make_the_call():
    url = "https://api.elevenlabs.io/v1/convai/twilio/outbound-call"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
    }

    payload = {
        "agent_id": AGENT_ID,
        "agent_phone_number_id": PHONE_NUMBER_ID,
        "to_number": MY_NUMBER,
        
        # Override the prompt just for this call
        "conversation_initiation_client_data": {
            "conversation_config_override": {
                "agent": {
                    "prompt": {
                        "prompt": (
                            "You are James, a personal assistant. "
                            "You are calling Nando's to book a table for 2 guys at 8pm. "
                            "You are polite, confident, and have a deep, attractive voice. " 
                            "If they ask for a name, say 'Tyrone'. "
                            "If they say yes to the booking, say 'Beautiful, see you then' and hang up."
                        )
                    },
                    "first_message": "Hello? Is this Nando's?"
                }
            }
        }
    }

    print(f">> Dialing {MY_NUMBER}... pick up, yeah?")
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code == 200:
            print(">> SUCCESS: James is calling you now.")
            print(f">> Call ID: {response.json().get('conversation_id')}")
        else:
            print(f">> ERROR {response.status_code}: {response.text}")
            
    except Exception as e:
        print(f">> CRITICAL FAIL: {e}")

if __name__ == "__main__":
    make_the_call()
