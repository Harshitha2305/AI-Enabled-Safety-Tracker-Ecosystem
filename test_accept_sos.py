
import requests

BASE_URL = "http://127.0.0.1:8000/api/"
TOKEN = input("Enter the approved volunteer login token: ").strip()
EMERGENCY_ID = 1

response = requests.post(
    f"{BASE_URL}alerts/{EMERGENCY_ID}/respond/",
    headers={"Authorization": f"Token {TOKEN}"},
    timeout=15,
)

print("Status:", response.status_code)
print("Response:", response.text)
