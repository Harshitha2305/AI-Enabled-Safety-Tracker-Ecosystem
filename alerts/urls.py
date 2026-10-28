
from django.urls import path
from .views import (
    RaiseEmergencyView,
    RespondToEmergencyView,
    RejectEmergencyView,
    ActiveEmergenciesView,
    ParentChildEmergenciesView,
    EmergencyNotificationsView,
    AcknowledgeEmergencyNotificationView,
    CancelEmergencyView,
    VolunteerSOSView,
    MyAssignedEmergenciesView,
)

urlpatterns = [
    path("raise/", RaiseEmergencyView.as_view(), name="raise-emergency"),
    path("volunteer-sos/", VolunteerSOSView.as_view(), name="volunteer-sos"),

    path(
        "<int:emergency_id>/respond/",
        RespondToEmergencyView.as_view(),
        name="respond-to-emergency",
    ),
    path(
        "<int:emergency_id>/reject/",
        RejectEmergencyView.as_view(),
        name="reject-emergency",
    ),
    path("active/", ActiveEmergenciesView.as_view(), name="active-emergencies"),
    path("mine/", MyAssignedEmergenciesView.as_view(), name="my-assigned-emergencies"),
    path(
        "<int:emergency_id>/cancel/",
        CancelEmergencyView.as_view(),
        name="cancel-emergency",
    ),
    path(
        "parent/emergencies/",
        ParentChildEmergenciesView.as_view(),
        name="parent-emergencies",
    ),
    path(
        "notifications/",
        EmergencyNotificationsView.as_view(),
        name="emergency-notifications",
    ),
    path(
        "notifications/<int:notification_id>/acknowledge/",
        AcknowledgeEmergencyNotificationView.as_view(),
        name="acknowledge-emergency-notification",
    ),
]
