
import requests

BASE_URL = "http://127.0.0.1:8000/api"

username = input("Parent username: ")
password = input("Parent password: ")

login = requests.post(
    f"{BASE_URL}/accounts/login/",
    json={"username": username, "password": password},
)
login.raise_for_status()

token = login.json()["token"]

response = requests.get(
    f"{BASE_URL}/alerts/parent/emergencies/",
    headers={"Authorization": f"Token {token}"},
)

print("Status:", response.status_code)
print("Parent emergencies:")
print(response.text)
