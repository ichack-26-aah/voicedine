OK, right now there is a view details button when i click the location on the map of the location, as well as opening up a new tab which the function currently does, , CALL THIS FUNCTION, calling the button BOOK TABLE, which will call this

import os
import requests
from dotenv import load_dotenv

load_dotenv()

# Fetch keys from environment variables
BLAND_API_KEY = os.getenv("BLAND_API_KEY")
BLAND_VOICE_ID = os.getenv("BLAND_VOICE_ID") 
MY_NUMBER = os.getenv("MY_NUMBER")

def trigger_call(to_number: str, restaurant_name: str) -> dict:
    if not BLAND_API_KEY:
        raise ValueError("Missing configuration: Ensure BLAND_API_KEY is set in .env")

    # Bland AI API Endpoint
    url = "https://api.bland.ai/v1/calls"
    
    headers = {
        "authorization": BLAND_API_KEY,
        "Content-Type": "application/json"
    }
    
    # This prompt is engineered to stop him breaking character
    strict_prompt = (
        "You are James, a confident, charming, and slightly flirtatious personal assistant. "
        "Your SOLE GOAL is to book a table at Nando's for 2 guys at 8pm tonight. "
        "Do NOT act like a generic AI. Do NOT ask 'How can I help you?'. "
        "You are speaking to the restaurant staff right now. "
        "1. Ask for the table politely but firmly. "
        "2. If they ask for a name, say 'Tyrone'. "
        "3. If they confirm, say 'Beautiful, see you then' and END THE CALL. "
        "4. If they say no, ask for 9pm. "
        "Keep your responses short (under 20 words). Speak like a real Londoner."
    )

    # Payload for Bland AI
    payload = {
        "phone_number": MY_NUMBER, # Override destination for demo
        "task": strict_prompt,
        
        "first_sentence": f"Hello? Is this {restaurant_name}? I need to book a table.",
        
        "max_duration": 4, # minutes
        "record": True,
        
        "language": "en-US", 
        "wait_for_greeting": False 
    }
    
    # Add voice ID if provided (Make sure this ID supports French for best results!)
    if BLAND_VOICE_ID:
        payload["voice"] = BLAND_VOICE_ID

    print(f">> Triggering French Bland AI call to {MY_NUMBER} (Demo override for {restaurant_name})...")
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error triggering call: {e}")
        if 'response' in locals() and response is not None:
             print(f"Response content: {response.content}")
        raise RuntimeError(f"Failed to trigger call: {e}")

# --- EXECUTION ---
if __name__ == "__main__":
    # You can change "Nando's" to something French like "Le Bistro" if you want
    trigger_call(MY_NUMBER, "Nando's")                                      # Bland AI Configuration
BLAND_API_KEY=org_5fd6a25bd05773ae3264620a27c2c6d95a767545cc08ade3d55613cb9e4819bc19e9db009e5cbec80de869                                                                                                           OK, right now there is a view details button when i click the location on the map of the location, as well as opening up a new tab which the function currently does, , CALL THIS FUNCTION, calling the button BOOK TABLE, which will call this