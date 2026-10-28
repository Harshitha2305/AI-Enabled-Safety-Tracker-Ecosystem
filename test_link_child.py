
import requests

BASE_URL = "http://127.0.0.1:8000/api"

# Log in as the PARENT
username = input("Parent username: ")
password = input("Parent password: ")

login_response = requests.post(
    f"{BASE_URL}/accounts/login/",
    json={"username": username, "password": password},
)
print("Login:", login_response.status_code, login_response.text)
login_response.raise_for_status()

token = login_response.json()["token"]
code = input("Enter the child's pairing code: ").strip()

response = requests.post(
    f"{BASE_URL}/accounts/link-child/",
    headers={"Authorization": f"Token {token}"},
    json={"pairing_code": code},
)

print("Link response:", response.status_code)
print(response.text)
