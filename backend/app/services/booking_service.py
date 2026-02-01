import os
import requests
from dotenv import load_dotenv

load_dotenv()

# Fetch keys from environment variables
BLAND_API_KEY = os.getenv("BLAND_API_KEY")
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

    # French prompt - James speaks French
    task_prompt = (
        f"Tu es James, un assistant personnel charmant et confiant. "
        f"Tu appelles le restaurant {restaurant_name} pour réserver une table pour 2 personnes à 20h ce soir. "
        f"Tu es poli, professionnel et un peu dragueur. "
        f"1. Commence par demander la réservation poliment mais fermement. "
        f"2. Si on te demande un nom, dis que c'est pour 'Tyrone'. "
        f"3. Si l'heure est confirmée, dis 'Fantastique, à tout à l'heure' et raccroche. "
        f"4. S'ils disent non pour 20h, demande 'Et vers 21h ?'. "
        f"Garde tes réponses courtes (moins de 20 mots). Ne propose pas d'autre aide. Réserve juste la table."
    )

    payload = {
        "phone_number": MY_NUMBER,  # Override destination for demo
        "task": task_prompt,
        "language": "fr",  # French language
        "reduce_latency": True,
        "max_duration": 5,  # minutes
        "record": True,
        "first_sentence": f"Bonjour? Est-ce que c'est le {restaurant_name}? J'aimerais réserver une table.",
        "wait_for_greeting": False
    }

    print(f">> James (French Mode) is dialling {MY_NUMBER} for {restaurant_name}...")

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        resp_data = response.json()
        print(f">> SUCCESS: Call ID {resp_data.get('call_id')}")
        return resp_data
    except requests.exceptions.RequestException as e:
        print(f">> Error triggering call: {e}")
        if 'response' in locals() and response is not None:
            print(f">> Response content: {response.content}")
        raise RuntimeError(f"Failed to trigger call: {e}")


# --- EXECUTION ---
if __name__ == "__main__":
    trigger_call(MY_NUMBER, "Nando's")
