
import requests

BASE_URL = "http://127.0.0.1:8000/api"

# Log in with your CHILD/USER account
username = input("Child username: ")
password = input("Child password: ")

login_response = requests.post(
    f"{BASE_URL}/accounts/login/",
    json={
        "username": username,
        "password": password,
    },
)

print("Login:", login_response.status_code, login_response.text)
login_response.raise_for_status()

token = login_response.json()["token"]

# Generate the pairing code
response = requests.post(
    f"{BASE_URL}/accounts/pairing-code/",
    headers={"Authorization": f"Token {token}"},
    json={},
)

print("Pairing code response:", response.status_code)
print(response.text)
