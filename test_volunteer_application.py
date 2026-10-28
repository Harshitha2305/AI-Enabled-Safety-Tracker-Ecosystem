
import requests
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000/api/accounts/"
TOKEN = input("Paste testvolunteer02 login token: ").strip()

files_dir = Path(input("Enter the folder path containing your 3 dummy files: ").strip().strip('"'))

data = {
    "experience": "Test application only. Volunteer first-aid practice.",
    "qualifications": "Dummy first-aid training for API testing.",
}

file_paths = {
    "government_id": files_dir / "test_id.pdf",
    "profile_photo": files_dir / "test_photo.jpg",
    "address_proof": files_dir / "test_address.pdf",
}

if not all(path.is_file() for path in file_paths.values()):
    raise FileNotFoundError(
        "One or more dummy files are missing. Check the folder and filenames."
    )

headers = {"Authorization": f"Token {TOKEN}"}

with requests.Session() as session:
    opened_files = {
        field: open(path, "rb")
        for field, path in file_paths.items()
    }
    try:
        response = session.post(
            BASE_URL + "volunteer-application/",
            headers=headers,
            data=data,
            files=opened_files,
            timeout=30,
        )
    finally:
        for file in opened_files.values():
            file.close()

print("Status:", response.status_code)
print("Response:", response.text)
