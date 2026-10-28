import requests

BASE_URL = "http://127.0.0.1:8000/api/"
TOKEN = input("Enter the approved volunteer login token: ").strip()

response = requests.get(
    BASE_URL + "alerts/active/",
    headers={"Authorization": f"Token {TOKEN}"},
    timeout=15,
)

print("Status:", response.status_code)
print("Response:", response.text)
