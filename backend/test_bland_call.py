import requests
import os
import json
from dotenv import load_dotenv

load_dotenv()

# --- CONFIGURATION ---
BLAND_API_KEY = os.getenv("BLAND_API_KEY")
MY_NUMBER = os.getenv("MY_NUMBER")

# NOTE: Voice "1" is British. He will speak French but with a British accent.
# If you want a native French accent, check the Bland dashboard for a French Voice ID.
VOICE_ID = "1" 

if not BLAND_API_KEY:
    print(">> ERROR: BLAND_API_KEY not found in .env")
    exit(1)

def trigger_bland_call():
    url = "https://api.bland.ai/v1/calls"
    
    headers = {
        "authorization": BLAND_API_KEY,
        "Content-Type": "application/json"
    }

    # --- THE FRENCH PROMPT ---
    # We write instructions in French so he doesn't get confused.
    task_prompt = (
        "Tu es James, un assistant personnel. "
        "Tu appelles le restaurant Nando's pour réserver une table pour 2 hommes à 20h ce soir. "
        "Tu es poli, confiant et un peu dragueur. "
        "1. Commence par demander : 'Bonjour, est-ce que c'est le Nando's ? J'ai besoin d'une table pour ce soir.' "
        "2. Si on te demande un nom, dis que c'est pour 'Tyrone'. "
        "3. Si l'heure est confirmée, dis 'Fantastique, à tout à l'heure' et raccroche. "
        "4. S'ils disent non, demande 'Et vers 21h ?'. "
        "Ne propose pas d'autre aide. Réserve juste la table."
    )

    payload = {
        "phone_number": MY_NUMBER,
        "task": task_prompt,
        "language": "fr",  # <--- CRITICAL CHANGE (French)
        # "voice": VOICE_ID,
        "reduce_latency": True,
        "max_duration": 5,
        
        # <--- CRITICAL CHANGE (He must start in French)
        "first_sentence": "Bonjour? Est-ce que c'est le Nando's?", 
        "wait_for_greeting": False
    }

    print(f">> James (French Mode) is dialling {MY_NUMBER}...")
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        resp_data = response.json()
        
        if response.status_code == 200:
            print(f">> SUCCESS: Call ID {resp_data.get('call_id')}")
            print(">> Pick up the phone. Parlez-vous français?")
        else:
            print(f">> ERROR: {resp_data}")
            
    except Exception as e:
        print(f">> CRITICAL FAIL: {e}")

if __name__ == "__main__":
    trigger_bland_call()