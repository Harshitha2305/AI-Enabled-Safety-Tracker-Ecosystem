from django.db import transaction
from math import radians, sin, cos, asin, sqrt
from django.contrib.auth.models import User
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import Emergency, EmergencyNotification, UserLocation
from accounts.permissions import IsApprovedVolunteer
from accounts.models import ParentChildLink, EmergencyContact


def build_sms_simulation(user, emergency):
    """Build SMS preview data only; this function never sends an SMS."""
    profile = getattr(user, "profile", None)
    display_name = (
        profile.full_name if profile and profile.full_name else user.username
    )
    if emergency.latitude is not None and emergency.longitude is not None:
        location_text = (
            "Simulated location: https://maps.google.com/?q="
            f"{emergency.latitude},{emergency.longitude}"
        )
    else:
        location_text = "Location unavailable."

    message = (
        f"SAFEGUARD SOS ALERT\n{display_name} needs help.\n"
        f"Emergency ID: {emergency.id}\n{location_text}\n"
        "SIMULATION ONLY - No SMS was sent."
    )
    previews = []
    primary_phone = (
        (profile.emergency_contact_phone or "").strip() if profile else ""
    )
    primary_name = (
        (profile.emergency_contact_name or "").strip() if profile else ""
    )
    if primary_phone:
        previews.append({
            "recipient_name": primary_name or "Primary emergency contact",
            "phone": primary_phone,
            "message": message,
            "status": "simulated_not_sent",
            "status_display": "SIMULATED - NOT SENT",
        })

    for contact in EmergencyContact.objects.filter(owner=user).order_by("created_at"):
        if contact.phone and contact.phone.strip():
            previews.append({
                "recipient_name": contact.name or "Emergency contact",
                "phone": contact.phone.strip(),
                "message": message,
                "status": "simulated_not_sent",
                "status_display": "SIMULATED - NOT SENT",
            })

    return {
        "mode": "simulation_only",
        "actual_sms_sent": False,
        "message": message,
        "recipients": previews,
        "recipients_count": len(previews),
    }


class RaiseEmergencyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = getattr(request.user, "profile", None)

        if profile is None or profile.role not in ("user", "parent"):
            return Response(
                {"error": "Only user and parent accounts can raise an SOS alert."},
                status=status.HTTP_403_FORBIDDEN,
            )

        latitude = request.data.get("latitude")
        longitude = request.data.get("longitude")

        if (latitude is None) != (longitude is None):
            return Response(
                {"error": "Provide both latitude and longitude, or neither."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            if latitude is not None and longitude is not None:
                latitude = float(latitude)
                longitude = float(longitude)

                if not (-90 <= latitude <= 90):
                    raise ValueError

                if not (-180 <= longitude <= 180):
                    raise ValueError

        except (TypeError, ValueError):
            return Response(
                {"error": "Invalid latitude or longitude."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        description = request.data.get("description", "")

        if not isinstance(description, str):
            return Response(
                {"error": "Description must be text."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            # Find all unresolved alerts from this user.
            unresolved = list(
                Emergency.objects.select_for_update()
                .filter(
                    user=request.user,
                    status__in=["active", "assigned", "responding"],
                )
                .order_by("-created_at")
            )

            if unresolved:
                # Keep the newest alert and close older duplicate alerts.
                emergency = unresolved[0]

                for duplicate in unresolved[1:]:
                    duplicate.status = "cancelled"
                    duplicate.save(
                        update_fields=["status", "updated_at"]
                    )

                    EmergencyNotification.objects.filter(
                        emergency=duplicate
                    ).update(
                        message=(
                            f"Emergency #{duplicate.id} was closed because "
                            "a duplicate SOS alert existed for the same user."
                        )
                    )

                # Refresh the location on the existing alert.
                if latitude is not None and longitude is not None:
                    emergency.latitude = latitude
                    emergency.longitude = longitude

                if description:
                    emergency.description = description

                emergency.save(
                    update_fields=[
                        "latitude",
                        "longitude",
                        "description",
                        "updated_at",
                    ]
                )

                return Response(
                    {
                        "message": (
                            "An SOS is already active. "
                            "The existing alert has been updated."
                        ),
                        "emergency_id": emergency.id,
                        "status": emergency.status,
                        "existing_alert": True,
                        "sms_simulation": build_sms_simulation(request.user, emergency),
                    },
                    status=status.HTTP_200_OK,
                )

            # Create a new emergency only when no unresolved alert exists.
            emergency = Emergency.objects.create(
                user=request.user,
                description=description,
                latitude=latitude,
                longitude=longitude,
            )

            recipient_ids = set()

            # Notify the linked parent when a child/user raises SOS.
            # Do not notify linked children when the parent raises SOS.
            if profile.role == "user":
                parent_ids = ParentChildLink.objects.filter(
                    child=request.user,
                    parent__isnull=False,
                ).values_list("parent_id", flat=True)

                recipient_ids.update(parent_ids)
            
            elif profile.role == "parent":
                child_ids = ParentChildLink.objects.filter(
                    parent=request.user,
                    child__isnull=False,
                ).values_list("child_id", flat=True)

                recipient_ids.update(child_ids)
            # Notify all approved volunteers.
            volunteer_ids = User.objects.filter(
                profile__role="volunteer",
                profile__volunteer_status="approved",
            ).values_list("id", flat=True)

            recipient_ids.update(volunteer_ids)
            recipient_ids.discard(request.user.id)

            recipients = list(
                User.objects.filter(id__in=recipient_ids)
            )

            display_name = profile.full_name or request.user.username

            if profile.role == "user":
                notification_message = (
                    f"{display_name} has raised an SOS alert."
                )
            else:
                notification_message = (
                    f"Parent {display_name} has raised an SOS alert."
                )

            EmergencyNotification.objects.bulk_create([
                EmergencyNotification(
                    recipient=recipient,
                    emergency=emergency,
                    message=notification_message,
                )
                for recipient in recipients
            ])

            # Simulated SMS only. No real SMS is sent.
            if latitude is not None and longitude is not None:
                location_text = (
                    f"Location: https://maps.google.com/?q={latitude},{longitude}"
                )
            else:
                location_text = "Location unavailable."

            sms_message = (
                "SAFEGUARD SOS ALERT\n"
                f"{display_name} needs help.\n"
                f"Emergency ID: {emergency.id}\n"
                f"{location_text}\n"
                "SIMULATION ONLY - No SMS was sent."
            )

            sms_previews = []

            primary_name = (
                profile.emergency_contact_name or ""
            ).strip()

            primary_phone = (
                profile.emergency_contact_phone or ""
            ).strip()

            if primary_phone:
                sms_previews.append({
                    "recipient_name": (
                        primary_name or "Primary emergency contact"
                    ),
                    "phone": primary_phone,
                    "message": sms_message,
                    "status": "simulated_not_sent",
                    "status_display": "SIMULATED - NOT SENT",
                })

            additional_contacts = EmergencyContact.objects.filter(
                owner=request.user
            ).order_by("created_at")

            for contact in additional_contacts:
                if contact.phone and contact.phone.strip():
                    sms_previews.append({
                        "recipient_name": contact.name,
                        "phone": contact.phone,
                        "message": sms_message,
                        "status": "simulated_not_sent",
                        "status_display": "SIMULATED - NOT SENT",
                    })

            # Print the SMS simulation in the Django terminal.
            print("\n" + "=" * 60, flush=True)
            print("       SAFEGUARD - SIMULATED SMS TERMINAL", flush=True)
            print("=" * 60, flush=True)
            print(f"Emergency ID: {emergency.id}", flush=True)
            print(f"Raised by: {display_name}", flush=True)
            print(f"Recipients: {len(sms_previews)}", flush=True)
            print("-" * 60, flush=True)

            if sms_previews:
                for index, sms in enumerate(sms_previews, start=1):
                    print(f"CONTACT #{index}", flush=True)
                    print(f"Name   : {sms['recipient_name']}", flush=True)
                    print(f"Phone  : {sms['phone']}", flush=True)
                    print(f"Status : {sms['status_display']}", flush=True)
                    print("-" * 60, flush=True)
                    print("MESSAGE:", flush=True)
                    print(sms["message"], flush=True)
                    print("-" * 60, flush=True)
            else:
                print(
                    "No emergency contacts with phone numbers found.",
                    flush=True,
                )

            print("SIMULATION ONLY - NO REAL SMS SENT", flush=True)
            print("=" * 60 + "\n", flush=True)

        return Response(
            {
                "message": "SOS alert created successfully.",
                "emergency_id": emergency.id,
                "status": emergency.status,
                "notifications_created": len(recipients),
                "existing_alert": False,
                "sms_simulation": {
                    "mode": "simulation_only",
                    "actual_sms_sent": False,
                    "message": sms_message,
                    "recipients": sms_previews,
                    "recipients_count": len(sms_previews),
                },
            },
            status=status.HTTP_201_CREATED,
        )


class EmergencyNotificationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = (
    EmergencyNotification.objects.filter(
        recipient=request.user,
        emergency__status__in=["active", "assigned", "responding"],
    )
    .select_related("emergency", "emergency__user")
    .order_by("-created_at")
)

        results = []

        for notification in notifications[:100]:
            emergency = notification.emergency

            results.append({
                "id": notification.id,
                "emergency_id": emergency.id,
                "message": notification.message,
                "is_read": notification.is_read,
                "acknowledged": notification.acknowledged_at is not None,
                "acknowledged_at": notification.acknowledged_at,
                "created_at": notification.created_at,
                "raised_by": emergency.user.username,
                "description": emergency.description,
                "latitude": emergency.latitude,
                "longitude": emergency.longitude,
                "status": emergency.status,
            })

        return Response(results, status=status.HTTP_200_OK)


class AcknowledgeEmergencyNotificationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        try:
            notification = EmergencyNotification.objects.get(
                id=notification_id,
                recipient=request.user,
            )
        except EmergencyNotification.DoesNotExist:
            return Response(
                {"error": "Notification not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if (
            not notification.is_read
            or notification.acknowledged_at is None
        ):
            notification.is_read = True
            notification.acknowledged_at = timezone.now()
            notification.save(
                update_fields=["is_read", "acknowledged_at"]
            )

        return Response(
            {
                "message": "Emergency notification acknowledged.",
                "notification_id": notification.id,
                "acknowledged": True,
            },
            status=status.HTTP_200_OK,
        )

class RespondToEmergencyView(APIView):
    permission_classes = [IsAuthenticated, IsApprovedVolunteer]

    def post(self, request, emergency_id):
        with transaction.atomic():
            try:
                emergency = Emergency.objects.select_for_update().get(
                    id=emergency_id,
                    status="active",
                    assigned_volunteer__isnull=True,
                )
            except Emergency.DoesNotExist:
                return Response(
                    {"error": "Emergency not found or already assigned."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Assign the selected emergency to this volunteer.
            emergency.assigned_volunteer = request.user
            emergency.status = "assigned"
            emergency.save(
                update_fields=[
                    "assigned_volunteer",
                    "status",
                    "updated_at",
                ]
            )

            # Close older duplicate ACTIVE alerts from the same user.
            duplicates = Emergency.objects.filter(
                user=emergency.user,
                status="active",
                assigned_volunteer__isnull=True,
            ).exclude(id=emergency.id)

            duplicate_ids = list(
                duplicates.values_list("id", flat=True)
            )

            duplicates.update(
                status="cancelled",
                updated_at=timezone.now(),
            )

            # Inform notification recipients about duplicate cleanup.
            if duplicate_ids:
                EmergencyNotification.objects.filter(
                    emergency_id__in=duplicate_ids
                ).update(
                    message=(
                        "This duplicate SOS alert was closed because "
                        f"Emergency #{emergency.id} is being handled."
                    )
                )

            # Update notifications for the accepted emergency.
            EmergencyNotification.objects.filter(
                emergency=emergency
            ).exclude(recipient=request.user).update(
                message=(
                    f"Emergency #{emergency.id} has been accepted by "
                    f"volunteer {request.user.username}."
                )
            )

        return Response(
            {
                "message": "Emergency accepted successfully.",
                "emergency_id": emergency.id,
                "status": emergency.status,
                "assigned_volunteer": request.user.username,
                "duplicate_alerts_closed": len(duplicate_ids),
            },
            status=status.HTTP_200_OK,
        )

class RejectEmergencyView(APIView):
    permission_classes = [IsAuthenticated, IsApprovedVolunteer]

    def post(self, request, emergency_id):
        with transaction.atomic():
            try:
                emergency = Emergency.objects.select_for_update().get(
                    id=emergency_id,
                    assigned_volunteer=request.user,
                    status__in=["assigned", "responding"],
                )
            except Emergency.DoesNotExist:
                return Response(
                    {
                        "error": (
                            "This emergency is not assigned to you, "
                            "or it can no longer be released."
                        )
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            emergency.assigned_volunteer = None
            emergency.status = "active"
            emergency.save(
                update_fields=[
                    "assigned_volunteer",
                    "status",
                    "updated_at",
                ]
            )

            EmergencyNotification.objects.filter(
                emergency=emergency
            ).update(
                message=(
                    f"Emergency #{emergency.id} has been released by "
                    f"volunteer {request.user.username} and is available "
                    "for another approved volunteer."
                )
            )

        print(
            f"[SAFEGUARD] Emergency #{emergency.id} released by "
            f"{request.user.username}.",
            flush=True,
        )

        return Response(
            {
                "message": "Emergency released successfully.",
                "emergency_id": emergency.id,
                "status": emergency.status,
                "assigned_volunteer": None,
            },
            status=status.HTTP_200_OK,
        )


class MyAssignedEmergenciesView(APIView):
    permission_classes = [IsAuthenticated, IsApprovedVolunteer]

    def get(self, request):
        emergencies = (
            Emergency.objects.filter(
                assigned_volunteer=request.user,
                status__in=["assigned", "responding"],
            )
            .select_related("user", "user__profile")
            .order_by("-updated_at")
        )

        results = []

        for emergency in emergencies:
            user = emergency.user
            profile = getattr(user, "profile", None)

            results.append({
                "id": emergency.id,
                "description": emergency.description,
                "status": emergency.status,
                "created_at": emergency.created_at,
                "updated_at": emergency.updated_at,
                "user_id": user.id,
                "username": user.username,
                "user_full_name": (
                    profile.full_name
                    if profile and profile.full_name
                    else user.username
                ),
                "user_phone": profile.phone if profile else "",
                "emergency_contact_name": (
                    profile.emergency_contact_name if profile else ""
                ),
                "emergency_contact_phone": (
                    profile.emergency_contact_phone if profile else ""
                ),
                "latitude": emergency.latitude,
                "longitude": emergency.longitude,
                "maps_url": (
                    f"https://maps.google.com/?q="
                    f"{emergency.latitude},{emergency.longitude}"
                    if emergency.latitude is not None
                    and emergency.longitude is not None
                    else None
                ),
                "location_is_simulated": True,
            })

        return Response(results, status=status.HTTP_200_OK)

class ActiveEmergenciesView(APIView):
    permission_classes = [IsAuthenticated, IsApprovedVolunteer]

    def get(self, request):
        # Fetch all emergencies first, including cancelled ones.
        emergencies = (
            Emergency.objects
            .exclude(user=request.user)
            .select_related("user", "user__profile")
            .order_by("-created_at", "-id")
        )

        # Keep only the newest emergency for each user.
        latest_by_user = {}

        for emergency in emergencies:
            if emergency.user_id not in latest_by_user:
                latest_by_user[emergency.user_id] = emergency

        results = []

        for emergency in latest_by_user.values():
            # Skip cancelled, resolved, closed, or otherwise inactive alerts.
            if str(emergency.status or "").lower() != "active":
                continue

            # Do not show emergencies already assigned to a volunteer.
            if emergency.assigned_volunteer_id is not None:
                continue

            user = emergency.user
            profile = getattr(user, "profile", None)

            if profile:
                full_name = profile.full_name or user.username
                phone = profile.phone or ""
                emergency_contact_name = (
                    profile.emergency_contact_name or ""
                )
                emergency_contact_phone = (
                    profile.emergency_contact_phone or ""
                )
            else:
                full_name = user.get_full_name() or user.username
                phone = ""
                emergency_contact_name = ""
                emergency_contact_phone = ""

            maps_url = None

            if (
                emergency.latitude is not None
                and emergency.longitude is not None
            ):
                maps_url = (
                    "https://maps.google.com/?q="
                    f"{emergency.latitude},{emergency.longitude}"
                )

            results.append({
                "id": emergency.id,
                "description": emergency.description,
                "status": emergency.status,
                "created_at": emergency.created_at,
                "user_id": user.id,
                "username": user.username,
                "user_full_name": full_name,
                "user_phone": phone,
                "emergency_contact_name": emergency_contact_name,
                "emergency_contact_phone": emergency_contact_phone,
                "latitude": emergency.latitude,
                "longitude": emergency.longitude,
                "maps_url": maps_url,
                "location_is_simulated": True,
            })

        return Response(results, status=status.HTTP_200_OK)

class ParentChildEmergenciesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "profile", None)

        if profile is None or profile.role != "parent":
            return Response(
                {"error": "Only parent accounts can view child emergencies."},
                status=status.HTTP_403_FORBIDDEN,
            )

        child_ids = ParentChildLink.objects.filter(
            parent=request.user
        ).values_list("child_id", flat=True)

        emergencies = (
    Emergency.objects.filter(
        user_id__in=child_ids,
        status__in=["active", "assigned", "responding"],
    )
    .select_related("user", "user__profile", "assigned_volunteer")
    .order_by("-created_at")
)   
        results = []

        for emergency in emergencies:
            child_profile = getattr(emergency.user, "profile", None)
            sms_simulation = build_sms_simulation(emergency.user, emergency)

            results.append({
                "id": emergency.id,
                "child_username": emergency.user.username,
                "child_full_name": (
                    child_profile.full_name
                    if child_profile and child_profile.full_name
                    else emergency.user.username
                ),
                "description": emergency.description,
                "emergency_contact_name": (
                    child_profile.emergency_contact_name
                    if child_profile else ""
                ),
                "emergency_contact_phone": (
                    child_profile.emergency_contact_phone
                    if child_profile else ""
                ),
                "sms_simulation": sms_simulation,
                "latitude": emergency.latitude,
                "longitude": emergency.longitude,
                "maps_url": (
                    "https://maps.google.com/?q="
                    f"{emergency.latitude},{emergency.longitude}"
                    if emergency.latitude is not None
                    and emergency.longitude is not None
                    else None
                ),
                "location_is_simulated": True,
                "status": emergency.status,
                "assigned_volunteer": (
                    emergency.assigned_volunteer.username
                    if emergency.assigned_volunteer
                    else None
                ),
                "created_at": emergency.created_at,
                "updated_at": emergency.updated_at,
            })

        return Response(results, status=status.HTTP_200_OK)

class CancelEmergencyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, emergency_id):
        with transaction.atomic():
            try:
                emergency = Emergency.objects.select_for_update().get(
                    id=emergency_id,
                    user=request.user,
                )
            except Emergency.DoesNotExist:
                # Do not allow one account to cancel another user's SOS.
                return Response(
                    {
                        "error": (
                            "SOS not found for your account. "
                            "Please check the emergency ID and logged-in user."
                        ),
                        "emergency_id": emergency_id,
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            if emergency.status in ["resolved", "cancelled"]:
                return Response(
                    {
                        "error": (
                            f"This emergency is already {emergency.status}."
                        ),
                        "emergency_id": emergency.id,
                        "status": emergency.status,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            emergency.status = "cancelled"
            emergency.save(
                update_fields=["status", "updated_at"]
            )

            EmergencyNotification.objects.filter(
                emergency=emergency
            ).update(
                message=(
                    f"Emergency #{emergency.id} has been cancelled "
                    "by the user."
                )
            )

        print(
            f"[SAFEGUARD] Emergency #{emergency.id} cancelled "
            f"by {request.user.username}.",
            flush=True,
        )

        return Response(
            {
                "message": "SOS cancelled successfully.",
                "emergency_id": emergency.id,
                "status": emergency.status,
            },
            status=status.HTTP_200_OK,
        )
class ParentSOSStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "profile", None)

        if profile is None or profile.role != "parent":
            return Response(
                {"error": "Only parent accounts can check parent SOS status."},
                status=status.HTTP_403_FORBIDDEN,
            )

        emergency = (
            Emergency.objects.filter(
                user=request.user,
                status__in=["active", "assigned", "responding"],
            )
            .order_by("-created_at", "-id")
            .first()
        )

        if emergency is None:
            return Response(
                {"active": False, "emergency_id": None},
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                "active": True,
                "emergency_id": emergency.id,
                "status": emergency.status,
            },
            status=status.HTTP_200_OK,
        )
class VolunteerSOSView(APIView):
    """
    Lets an approved volunteer raise and check their own safety SOS.
    Notifications go to other approved volunteers, not to the caller.
    """

    permission_classes = [IsAuthenticated, IsApprovedVolunteer]

    def get(self, request):
        emergency = (
            Emergency.objects.filter(
                user=request.user,
                status__in=["active", "assigned", "responding"],
            )
            .order_by("-created_at")
            .first()
        )

        if not emergency:
            return Response(
                {"active": False, "emergency_id": None, "sms_simulation": None},
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                "active": True,
                "emergency_id": emergency.id,
                "sms_simulation": build_sms_simulation(request.user, emergency),
                "status": emergency.status,
                "latitude": emergency.latitude,
                "longitude": emergency.longitude,
                "created_at": emergency.created_at,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        latitude = request.data.get("latitude", 12.9716)
        longitude = request.data.get("longitude", 77.5946)

        try:
            latitude = float(latitude)
            longitude = float(longitude)

            if not (-90 <= latitude <= 90):
                raise ValueError

            if not (-180 <= longitude <= 180):
                raise ValueError

        except (TypeError, ValueError):
            return Response(
                {"error": "Invalid simulated latitude or longitude."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile = getattr(request.user, "profile", None)
        display_name = (
            profile.full_name
            if profile and profile.full_name
            else request.user.username
        )

        with transaction.atomic():
            unresolved = list(
                Emergency.objects.select_for_update()
                .filter(
                    user=request.user,
                    status__in=["active", "assigned", "responding"],
                )
                .order_by("-created_at")
            )

            if unresolved:
                # Reuse the newest unresolved SOS; do not create duplicates.
                emergency = unresolved[0]
                emergency.latitude = latitude
                emergency.longitude = longitude
                emergency.description = (
                    "VOLUNTEER SAFETY SOS: "
                    f"{display_name} needs assistance. "
                    "Location is simulated."
                )
                emergency.save(
                    update_fields=[
                        "latitude",
                        "longitude",
                        "description",
                        "updated_at",
                    ]
                )

                return Response(
                    {
                        "message": "Your existing volunteer SOS is still active.",
                        "emergency_id": emergency.id,
                        "status": emergency.status,
                        "existing_alert": True,
                        "sms_simulation": build_sms_simulation(request.user, emergency),
                    },
                    status=status.HTTP_200_OK,
                )

            emergency = Emergency.objects.create(
                user=request.user,
                description=(
                    "VOLUNTEER SAFETY SOS: "
                    f"{display_name} needs assistance. "
                    "Location is simulated."
                ),
                latitude=latitude,
                longitude=longitude,
            )

            # Notify other approved volunteers, excluding the caller.
            recipients = list(
                User.objects.filter(
                    profile__role="volunteer",
                    profile__volunteer_status="approved",
                ).exclude(id=request.user.id)
            )

            notification_message = (
                f"VOLUNTEER SOS: {display_name} needs assistance. "
                f"Emergency #{emergency.id}. "
                f"Simulated location: {latitude}, {longitude}."
            )

            EmergencyNotification.objects.bulk_create([
                EmergencyNotification(
                    recipient=recipient,
                    emergency=emergency,
                    message=notification_message,
                )
                for recipient in recipients
            ])

        print("\n" + "=" * 55, flush=True)
        print("SAFEGUARD — VOLUNTEER SOS (SIMULATION)", flush=True)
        print(f"Volunteer: {display_name}", flush=True)
        print(f"Emergency ID: {emergency.id}", flush=True)
        print(f"Notified other approved volunteers: {len(recipients)}", flush=True)
        print(f"Simulated coordinates: {latitude}, {longitude}", flush=True)
        print("No real GPS or SMS used.", flush=True)
        print("=" * 55 + "\n", flush=True)

        return Response(
            {
                "message": "Volunteer SOS sent to other approved volunteers.",
                "emergency_id": emergency.id,
                "status": emergency.status,
                "notifications_created": len(recipients),
                "existing_alert": False,
                "sms_simulation": build_sms_simulation(request.user, emergency),
            },
            status=status.HTTP_201_CREATED,
        )



# Bengaluru-only coarse geofence (approximate city bounds, not an official boundary).
BENGALURU_BOUNDS = {
    "min_latitude": 12.70,
    "max_latitude": 13.20,
    "min_longitude": 77.30,
    "max_longitude": 77.95,
}
LOCATION_MIN_MOVEMENT_METRES = 20
LOCATION_MAX_AGE_NOTE = "Location timestamp indicates when the device last updated."


def is_inside_bengaluru(latitude, longitude):
    return (
        BENGALURU_BOUNDS["min_latitude"] <= latitude <= BENGALURU_BOUNDS["max_latitude"]
        and BENGALURU_BOUNDS["min_longitude"] <= longitude <= BENGALURU_BOUNDS["max_longitude"]
    )


def distance_metres(lat1, lon1, lat2, lon2):
    earth_radius_m = 6371000
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return earth_radius_m * 2 * asin(sqrt(min(1, a)))


class UserLiveLocationView(APIView):
    """
    POST: user accounts publish browser GPS; parent and volunteer accounts
    publish demo coordinates. Locations are accepted inside Bengaluru bounds.
    Parent and volunteer coordinates must be marked as simulated by the API consumer.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = getattr(request.user, "profile", None)
        if profile is None or profile.role not in ("user", "parent", "volunteer"):
            return Response(
                {"error": "Only user, parent, and volunteer accounts can publish their location."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            latitude = float(request.data.get("latitude"))
            longitude = float(request.data.get("longitude"))
            accuracy = request.data.get("accuracy_m")
            accuracy = float(accuracy) if accuracy is not None else None
            if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
                raise ValueError
            if accuracy is not None and not (0 <= accuracy <= 10000):
                raise ValueError
        except (TypeError, ValueError):
            return Response(
                {"error": "Valid latitude and longitude are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not is_inside_bengaluru(latitude, longitude):
            return Response(
                {
                    "accepted": False,
                    "outside_supported_area": True,
                    "message": "Location is outside the supported Bengaluru area.",
                },
                status=status.HTTP_200_OK,
            )

        current, _ = UserLocation.objects.get_or_create(
            user=request.user,
            defaults={
                "latitude": latitude,
                "longitude": longitude,
                "accuracy_m": accuracy,
            },
        )

        if current.pk and current.updated_at:
            moved = distance_metres(
                current.latitude, current.longitude, latitude, longitude
            )
            # Update if movement is meaningful OR 60 seconds have elapsed,
            # so a stationary user's timestamp can still be refreshed.
            elapsed = (timezone.now() - current.updated_at).total_seconds()
            if moved < LOCATION_MIN_MOVEMENT_METRES and elapsed < 60:
                return Response({
                    "accepted": True,
                    "updated": False,
                    "reason": "movement_below_threshold",
                    "latitude": current.latitude,
                    "longitude": current.longitude,
                    "updated_at": current.updated_at,
                }, status=status.HTTP_200_OK)

        current.latitude = latitude
        current.longitude = longitude
        current.accuracy_m = accuracy
        current.save()

        # Keep any currently active SOS coordinates in sync with the latest
        # valid location, but do not create an SOS just for location tracking.
        Emergency.objects.filter(
            user=request.user,
            status__in=["active", "assigned", "responding"],
        ).update(
            latitude=latitude,
            longitude=longitude,
            updated_at=timezone.now(),
        )

        return Response({
            "accepted": True,
            "updated": True,
            "latitude": current.latitude,
            "longitude": current.longitude,
            "accuracy_m": current.accuracy_m,
            "updated_at": current.updated_at,
            "outside_supported_area": False,
        }, status=status.HTTP_200_OK)


class ParentLiveLocationsView(APIView):
    """Return latest location for only the children linked to this parent."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "profile", None)
        if profile is None or profile.role != "parent":
            return Response(
                {"error": "Only parent accounts can view linked child locations."},
                status=status.HTTP_403_FORBIDDEN,
            )

        child_ids = ParentChildLink.objects.filter(
            parent=request.user
        ).values_list("child_id", flat=True)

        locations = (
            UserLocation.objects.filter(user_id__in=child_ids)
            .select_related("user", "user__profile")
            .order_by("user__username")
        )
        results = []
        for location in locations:
            child = location.user
            child_profile = getattr(child, "profile", None)
            results.append({
                "user_id": child.id,
                "child_username": child.username,
                "child_full_name": (
                    child_profile.full_name
                    if child_profile and child_profile.full_name
                    else child.username
                ),
                "latitude": location.latitude,
                "longitude": location.longitude,
                "accuracy_m": location.accuracy_m,
                "updated_at": location.updated_at,
                "maps_url": f"https://maps.google.com/?q={location.latitude},{location.longitude}",
                "outside_supported_area": not is_inside_bengaluru(
                    location.latitude, location.longitude
                ),
            })
        return Response(results, status=status.HTTP_200_OK)


class RelatedLiveLocationsView(APIView):
    """
    Return only locations relevant to the authenticated account.
    Parent and volunteer accounts use demo locations.
    """
    permission_classes = [IsAuthenticated]

    ACTIVE_STATUSES = ["active", "assigned", "responding"]
    ASSIGNED_STATUSES = ["assigned", "responding"]

    def get(self, request):
        profile = getattr(request.user, "profile", None)

        if profile is None or profile.role not in (
            "user", "parent", "volunteer"
        ):
            return Response(
                {"error": "Unsupported account role."},
                status=status.HTTP_403_FORBIDDEN,
            )

        results = {}

        def add_location(user, relation):
            if user is None:
                return

            location = UserLocation.objects.filter(user=user).first()
            if location is None:
                return

            related_profile = getattr(user, "profile", None)
            role = related_profile.role if related_profile else "unknown"

            results[user.id] = {
                "user_id": user.id,
                "username": user.username,
                "full_name": (
                    related_profile.full_name
                    if related_profile and related_profile.full_name
                    else user.username
                ),
                "role": role,
                "relation": relation,
                "latitude": location.latitude,
                "longitude": location.longitude,
                "accuracy_m": location.accuracy_m,
                "is_simulated": role in ("parent", "volunteer"),
                "updated_at": location.updated_at,
                "maps_url": (
                    f"https://maps.google.com/?q="
                    f"{location.latitude},{location.longitude}"
                ),
            }

        # Always show the signed-in account's own location.
        add_location(request.user, "self")

        if profile.role == "user":
            parent_link = (
                ParentChildLink.objects.filter(
                    child=request.user,
                    parent__isnull=False,
                )
                .select_related("parent")
                .first()
            )

            if parent_link:
                add_location(parent_link.parent, "linked_parent")

            assignments = Emergency.objects.filter(
                user=request.user,
                status__in=self.ASSIGNED_STATUSES,
                assigned_volunteer__isnull=False,
            ).select_related("assigned_volunteer")

            for emergency in assignments:
                add_location(
                    emergency.assigned_volunteer,
                    "assigned_volunteer",
                )

        elif profile.role == "parent":
            links = list(
                ParentChildLink.objects.filter(
                    parent=request.user
                ).select_related("child")
            )
            child_ids = [link.child_id for link in links]

            # Parent can see linked children's saved locations.
            for link in links:
                add_location(link.child, "linked_child")

            # Only show volunteers assigned to an active emergency
            # raised by this parent or one of their linked children.
            assignments = Emergency.objects.filter(
                user_id__in=child_ids + [request.user.id],
                status__in=self.ASSIGNED_STATUSES,
                assigned_volunteer__isnull=False,
            ).select_related("assigned_volunteer")

            for emergency in assignments:
                add_location(
                    emergency.assigned_volunteer,
                    "assigned_volunteer_for_related_emergency",
                )

        elif profile.role == "volunteer":
            # Only people involved in emergencies assigned to this volunteer.
            assignments = Emergency.objects.filter(
                assigned_volunteer=request.user,
                status__in=self.ASSIGNED_STATUSES,
            ).select_related("user")

            for emergency in assignments:
                add_location(emergency.user, "assigned_person")

        return Response(
            list(results.values()),
            status=status.HTTP_200_OK,
        )


class AssignedEmergencyLiveLocationView(APIView):
    """Volunteers can read live coordinates only for an emergency assigned to them."""
    permission_classes = [IsAuthenticated, IsApprovedVolunteer]

    def get(self, request, emergency_id):
        try:
            emergency = Emergency.objects.select_related("user").get(
                id=emergency_id,
                assigned_volunteer=request.user,
                status__in=["assigned", "responding"],
            )
        except Emergency.DoesNotExist:
            return Response(
                {"error": "Live location is available only for an active emergency assigned to you."},
                status=status.HTTP_404_NOT_FOUND,
            )

        location = UserLocation.objects.filter(user=emergency.user).first()
        latitude = location.latitude if location else emergency.latitude
        longitude = location.longitude if location else emergency.longitude
        updated_at = location.updated_at if location else emergency.updated_at
        return Response({
            "emergency_id": emergency.id,
            "status": emergency.status,
            "latitude": latitude,
            "longitude": longitude,
            "updated_at": updated_at,
            "location_is_simulated": False if location else True,
            "maps_url": (
                f"https://maps.google.com/?q={latitude},{longitude}"
                if latitude is not None and longitude is not None else None
            ),
        }, status=status.HTTP_200_OK)
class MySOSStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        emergency = Emergency.objects.filter(
            user=request.user,
            status__in=["active", "assigned", "responding"],
        ).order_by("-created_at", "-id").first()

        if emergency is None:
            return Response({
                "active": False,
                "emergency_id": None,
            }, status=status.HTTP_200_OK)

        return Response({
            "active": True,
            "emergency_id": emergency.id,
            "status": emergency.status,
        }, status=status.HTTP_200_OK)