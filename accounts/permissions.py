from rest_framework.permissions import BasePermission


class IsApprovedVolunteer(BasePermission):
    message = "Only approved volunteers can respond to emergencies."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        profile = getattr(user, "profile", None)

        return (
            profile is not None
            and profile.role == "volunteer"
            and profile.volunteer_status == "approved"
        )