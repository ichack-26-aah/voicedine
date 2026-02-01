import requests
import json
import os
import sys
from dotenv import load_dotenv

# Load env vars from .env file
load_dotenv()

# --- LOAD YOUR KEYS ---
BLAND_API_KEY = os.getenv("BLAND_API_KEY")
MY_NUMBER = os.getenv("MY_NUMBER")

if not all([BLAND_API_KEY, MY_NUMBER]):
    print(">> Missing keys, fam. Fix your env variables.")
    sys.exit(1)

def force_the_call():
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

    payload = {
        "phone_number": MY_NUMBER,
        "task": strict_prompt,
        "language": "en-US", # Or en-GB
        "reduce_latency": True,
        "max_duration": 4, 
        "first_sentence": "Hello? Is this Nando's? I need a table for tonight.",
        "wait_for_greeting": False
    }

    print(f">> James (Advanced Bland AI) is dialling {MY_NUMBER}...")
    print(f">> Instructions: {strict_prompt[:50]}...")
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        resp_data = response.json()
        
        if response.status_code == 200:
            print(f">> SUCCESS: Call ID {resp_data.get('call_id')}")
            print(">> Pick up the phone.")
        else:
            print(f">> ERROR {response.status_code}: {response.text}")
            
    except Exception as e:
        print(f">> CRITICAL FAIL: {e}")

if __name__ == "__main__":
    force_the_call()
