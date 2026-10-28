from django.urls import path

from .views import (
    RegistrationView,
    LoginView,
    ProfileView,
    EmergencyContactListCreateView,
    EmergencyContactDetailView,
    VolunteerApplicationView,
    GeneratePairingCodeView,
    LinkChildView,
    ParentChildrenView,
)

urlpatterns = [
    path("register/", RegistrationView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),

    # User profile
    path("profile/", ProfileView.as_view(), name="profile"),

    # Additional emergency contacts
    path(
        "emergency-contacts/",
        EmergencyContactListCreateView.as_view(),
        name="emergency-contact-list-create",
    ),
    path(
        "emergency-contacts/<int:contact_id>/",
        EmergencyContactDetailView.as_view(),
        name="emergency-contact-detail",
    ),

    # Volunteer application
    path(
        "volunteer-application/",
        VolunteerApplicationView.as_view(),
        name="volunteer-application",
    ),

    # Parent-child pairing
    path(
        "pairing-code/",
        GeneratePairingCodeView.as_view(),
        name="pairing-code",
    ),
    path(
        "link-child/",
        LinkChildView.as_view(),
        name="link-child",
    ),
    path(
        "children/",
        ParentChildrenView.as_view(),
        name="parent-children",
    ),
]
