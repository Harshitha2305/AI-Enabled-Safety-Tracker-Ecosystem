from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def home(request):
    return JsonResponse({
        "status": "success",
        "message": "AI Safety Tracker Backend is running",
        "sensor_api": "/api/sensor-data/",
    })


urlpatterns = [
    path("", home),
    path("admin/", admin.site.urls),
    path("api/sensor-data/", include("sensor_data.urls")),
    path("api/accounts/", include("accounts.urls")),
    path("api/alerts/", include("alerts.urls")),
]
