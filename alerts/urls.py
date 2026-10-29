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
    UserLiveLocationView,
    ParentLiveLocationsView,
    RelatedLiveLocationsView,
    AssignedEmergencyLiveLocationView,
    ParentSOSStatusView,
    MySOSStatusView,
)

urlpatterns = [
    # SOS / emergency workflows
    path("raise/", RaiseEmergencyView.as_view(), name="raise-emergency"),
    path("<int:emergency_id>/respond/", RespondToEmergencyView.as_view(), name="respond-to-emergency"),
    path("<int:emergency_id>/reject/", RejectEmergencyView.as_view(), name="reject-emergency"),
    path("active/", ActiveEmergenciesView.as_view(), name="active-emergencies"),
    path("mine/", MyAssignedEmergenciesView.as_view(), name="my-assigned-emergencies"),
    path("<int:emergency_id>/cancel/", CancelEmergencyView.as_view(), name="cancel-emergency"),
    path("volunteer-sos/", VolunteerSOSView.as_view(), name="volunteer-sos"),
    path("parent/emergencies/", ParentChildEmergenciesView.as_view(), name="parent-emergencies"),
    path("notifications/", EmergencyNotificationsView.as_view(), name="emergency-notifications"),
    path(
        "notifications/<int:notification_id>/acknowledge/",
        AcknowledgeEmergencyNotificationView.as_view(),
        name="acknowledge-emergency-notification",
    ),

    # Live location
    path("location/update/", UserLiveLocationView.as_view(), name="user-live-location-update"),
    path("parent/locations/", ParentLiveLocationsView.as_view(), name="parent-live-locations"),
    path(
    "related/locations/",
    RelatedLiveLocationsView.as_view(),
    name="related-live-locations",),
    path(
        "<int:emergency_id>/live-location/",
        AssignedEmergencyLiveLocationView.as_view(),
        name="assigned-emergency-live-location",
    ),
    path(
    "parent/sos/",
    ParentSOSStatusView.as_view(),
    name="parent-sos-status",
),
    path("my-sos/", MySOSStatusView.as_view(), name="my-sos-status"),
]
