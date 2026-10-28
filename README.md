# 🛡️ SAFEGUARD — AI-Enabled Safety Tracker Ecosystem

**A smart safety monitoring platform designed to connect individuals and families through real-time safety monitoring, SOS alerts, and emergency notifications.**

## 📌 Overview

SAFEGUARD is a safety-focused web application developed to support emergency assistance and connected safety monitoring. It combines a React-based frontend with a Django REST Framework backend to provide safety dashboards, sensor data monitoring, fall detection logic, and parent–child emergency communication.

The project currently supports software-based sensor simulation for demonstration, with hardware integration planned as the system evolves.

## ✨ Features

- **Safety Dashboard:** View safety-related information through a user-friendly interface.
- **SOS Alerts:** Raise emergency requests and notify linked users.
- **Parent–Child Safety:** Support safety communication between linked parent and child accounts.
- **Fall Detection:** Apply fall-detection logic to incoming or simulated sensor readings.
- **Sensor Monitoring:** Send and retrieve sensor data through backend APIs.
- **Volunteer Support:** Include volunteer-related registration and application functionality.
- **REST API Integration:** Connect the frontend and backend through Django REST Framework.
- **Sensor Simulation:** Demonstrate sensor-based workflows without requiring all physical hardware components.

## 🧰 Technology Stack

| Component | Technologies |
|---|---|
| Frontend | React, Vite, JavaScript, CSS |
| Backend | Python, Django, Django REST Framework |
| Database | SQLite for local development |
| API Communication | REST APIs |
| Sensor Demonstration | Python sensor simulator |
| Version Control | Git and GitHub |

## 📂 Project Structure

```text
AI_SAFETY_TRACKER/
├── accounts/             # User accounts and profiles
├── alerts/               # Emergency alerts and notifications
├── backend/              # Django project configuration
├── devices/              # Device-related functionality
├── frontend/             # React + Vite application
├── locations/            # Location-related functionality
├── sensor_data/          # Sensor data models and APIs
├── simulation/           # Sensor simulation scripts
├── manage.py              # Django management script
├── test_accept_sos.py
├── test_active_sos.py
├── test_link_child.py
├── test_pairing.py
├── test_parent_emergencies.py
├── test_raise_sos.py
└── test_volunteer_application.py
```

## ⚙️ Getting Started

### Prerequisites

Install the following before running the application:

- Python 3.10 or a compatible version supported by your Django dependencies
- Node.js and npm
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/Harshitha2305/AI-Enabled-Safety-Tracker-Ecosystem.git
cd AI-Enabled-Safety-Tracker-Ecosystem
```

### 2. Set Up the Backend

Create and activate a virtual environment.

**Windows — Command Prompt:**

```cmd
python -m venv venv
venv\Scripts\activate
```

Install the backend dependencies:

```cmd
pip install django djangorestframework
```

If you have a `requirements.txt` file, use it instead:

```cmd
pip install -r requirements.txt
```

Configure the Django environment variables and database settings before running the application. Then apply migrations:

```cmd
python manage.py migrate
python manage.py runserver
```

The backend will usually be available at:

`http://127.0.0.1:8000/`

### 3. Set Up the Frontend

Open a second Command Prompt window and navigate to the frontend folder:

```cmd
cd frontend
npm install
npm run dev
```

Vite will display the local frontend URL in the terminal, typically:

`http://localhost:5173/`

### 4. Run the Sensor Simulator

From the project root, activate your Python environment and run:

```cmd
python simulation/sensor_simulator.py
```

Configure the backend URL and any required settings in the simulator before starting it. Run this only when the backend is available.

## 🔌 API Integration

The Django backend provides REST endpoints for the application's safety-related functionality.

Examples of API routes used or developed during the project include:

- `/api/sensor-data/all/` — Retrieve sensor readings.
- `/api/sensor-data/send/` — Submit sensor readings.

Other routes support account management, emergency alerts, device information, and related workflows. Refer to the Django URL configurations for the exact available endpoints.

## 🔐 Security

- Never commit passwords, API tokens, Django secret keys, or `.env` files.
- Do not publish real user records, uploaded identity documents, or private profile photos.
- Use environment variables for sensitive configuration.
- Configure authentication and permissions before deploying the application publicly.
- Use HTTPS and appropriate access controls for production deployments.

## 🚧 Project Status

SAFEGUARD is an ongoing development project.

The web application and software-based sensor simulation demonstrate core safety workflows. Full hardware integration, reliable live location tracking, and real-world emergency delivery depend on the availability and configuration of the relevant devices, communication services, and backend infrastructure.

## 🔮 Future Enhancements

- Integrate ESP32-based sensor hardware.
- Add GPS/GNSS-based live location tracking.
- Improve fall-detection accuracy using real sensor readings.
- Strengthen offline emergency communication and SMS fallback.
- Expand automated testing and deployment.
- Improve monitoring, privacy controls, and production security.

## 🎯 Objective

To develop an extensible safety monitoring ecosystem that supports emergency assistance, connected family safety, and sensor-assisted monitoring through an integrated web application.

## 👩‍💻 Author

**Harshitha2305**

GitHub: [@Harshitha2305](https://github.com/Harshitha2305)

---

*Built as a software development project exploring connected safety systems, web technologies, and sensor-based monitoring.*
