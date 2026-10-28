
import requests

BASE_URL = "http://127.0.0.1:8000/api/"
TOKEN = input("Enter the testuser01 login token: ").strip()

headers = {
    "Authorization": f"Token {TOKEN}",
}

payload = {
    "description": "Test SOS alert - API verification only.",
    "latitude": 12.9716,
    "longitude": 77.5946,
}

response = requests.post(
    BASE_URL + "alerts/raise/",
    headers=headers,
    json=payload,
    timeout=15,
)

print("Status:", response.status_code)
print("Response:", response.text)
