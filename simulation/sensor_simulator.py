import random
import time
import requests


API_URL = "http://127.0.0.1:8000/api/sensor-data/send/"


def generate_sensor_data():

    # Occasionally simulate a fall
    fall_event = random.random() < 0.15

    if fall_event:
        acceleration_x = round(random.uniform(5.0, 9.0), 2)
        acceleration_y = round(random.uniform(5.0, 9.0), 2)
        acceleration_z = round(random.uniform(15.0, 20.0), 2)

        print("\n🚨 FALL EVENT SIMULATED!")

    else:
        acceleration_x = round(random.uniform(0.5, 2.0), 2)
        acceleration_y = round(random.uniform(0.1, 1.0), 2)
        acceleration_z = round(random.uniform(8.5, 10.5), 2)

    data = {
        "device_id": "TRACKER001",

        "acceleration_x": acceleration_x,
        "acceleration_y": acceleration_y,
        "acceleration_z": acceleration_z,

        "gyro_x": round(random.uniform(0.0, 1.0), 2),
        "gyro_y": round(random.uniform(0.0, 1.0), 2),
        "gyro_z": round(random.uniform(0.0, 1.0), 2),
    }

    return data

while True:

    sensor_data = generate_sensor_data()

    print("\n--- Sending Sensor Data ---")
    print("Device ID:", sensor_data["device_id"])
    print("Acceleration X:", sensor_data["acceleration_x"])
    print("Acceleration Y:", sensor_data["acceleration_y"])
    print("Acceleration Z:", sensor_data["acceleration_z"])
    print("Gyro X:", sensor_data["gyro_x"])
    print("Gyro Y:", sensor_data["gyro_y"])
    print("Gyro Z:", sensor_data["gyro_z"])

    try:

        response = requests.post(
            API_URL,
            json=sensor_data
        )

        print("API Status:", response.status_code)

        if response.ok:
            print("✓ Sensor data stored successfully")
        else:
            print("✗ API Error:", response.text)

    except requests.exceptions.ConnectionError:
        print("✗ Cannot connect to Django server")

    time.sleep(5)