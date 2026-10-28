import secrets
from datetime import timedelta

from django.utils import timezone
from django.contrib.auth.models import User

from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, MultiPartParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from rest_framework import serializers

from .models import (
    UserProfile,
    EmergencyContact,
    VolunteerApplication,
    ParentChildLink,
)
from .serializers import (
    RegistrationSerializer,
    LoginSerializer,
    VolunteerApplicationSerializer,
)


class RegistrationView(generics.CreateAPIView):
    serializer_class = RegistrationSerializer
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response(
            {
                "message": (
                    "Registration submitted. "
                    "Your account is pending verification."
                ),
                "username": user.username,
                "role": user.profile.role,
                "verification_status": user.profile.verification_status,
                "volunteer_status": user.profile.volunteer_status,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(generics.GenericAPIView):
    serializer_class = LoginSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        profile = user.profile
        token, _ = Token.objects.get_or_create(user=user)

        return Response(
            {
                "message": "Login successful.",
                "token": token.key,
                "username": user.username,
                "role": profile.role,
                "volunteer_status": profile.volunteer_status,
                "verification_status": profile.verification_status,
            },
            status=status.HTTP_200_OK,
        )


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        profile = request.user.profile

        photo_url = (
            request.build_absolute_uri(profile.profile_photo.url)
            if profile.profile_photo
            else None
        )

        return Response(
            {
                "username": request.user.username,
                "email": request.user.email,
                "role": profile.role,
                "full_name": profile.full_name,
                "phone": profile.phone,
                "address": profile.address,
                "date_of_birth": profile.date_of_birth,
                "profile_photo": photo_url,
                "emergency_contact_name": profile.emergency_contact_name,
                "emergency_contact_phone": profile.emergency_contact_phone,
                "emergency_contact_relationship":
                    profile.emergency_contact_relationship,
                "verification_status": profile.verification_status,
                "phone_verified": profile.phone_verified,
                "volunteer_status": profile.volunteer_status,
            },
            status=status.HTTP_200_OK,
        )

    def patch(self, request):
        profile = request.user.profile
        data = request.data

        allowed_fields = {
            "full_name",
            "phone",
            "address",
            "date_of_birth",
        }

        for field in allowed_fields:
            if field in data:
                value = data[field]

                if field in {"full_name", "phone", "address"}:
                    value = str(value).strip()

                if field == "full_name" and len(value) < 2:
                    return Response(
                        {"full_name": ["Enter your full name."]},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                setattr(profile, field, value)

        if "email" in data:
            email = str(data["email"]).strip().lower()

            if not email:
                return Response(
                    {"email": ["Email is required."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if User.objects.filter(email__iexact=email).exclude(
                pk=request.user.pk
            ).exists():
                return Response(
                    {"email": ["This email is already in use."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            request.user.email = email
            request.user.save(update_fields=["email"])

        if "profile_photo" in request.FILES:
            profile.profile_photo = request.FILES["profile_photo"]

        profile.save()

        return Response(
            {
                "message": "Profile updated successfully.",
                "full_name": profile.full_name,
                "phone": profile.phone,
                "address": profile.address,
                "date_of_birth": profile.date_of_birth,
            },
            status=status.HTTP_200_OK,
        )


class EmergencyContactListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get(self, request):
        contacts = EmergencyContact.objects.filter(
            owner=request.user
        )

        return Response(
            [
                {
                    "id": contact.id,
                    "name": contact.name,
                    "phone": contact.phone,
                    "relationship": contact.relationship,
                    "is_verified": contact.is_verified,
                    "created_at": contact.created_at,
                }
                for contact in contacts
            ],
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        name = str(request.data.get("name", "")).strip()
        phone = str(request.data.get("phone", "")).strip()
        relationship = str(
            request.data.get("relationship", "")
        ).strip()

        if not name or not phone or not relationship:
            return Response(
                {
                    "error": (
                        "Name, phone number, and relationship "
                        "are all required."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        digits = phone.replace("+", "")

        if (
            not digits.isdigit()
            or phone.count("+") > 1
            or ("+" in phone and not phone.startswith("+"))
            or not 10 <= len(digits) <= 15
        ):
            return Response(
                {"phone": ["Enter a valid phone number."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        contact = EmergencyContact.objects.create(
            owner=request.user,
            name=name,
            phone=phone,
            relationship=relationship,
            is_verified=False,
        )

        return Response(
            {
                "message": "Emergency contact added successfully.",
                "contact": {
                    "id": contact.id,
                    "name": contact.name,
                    "phone": contact.phone,
                    "relationship": contact.relationship,
                    "is_verified": contact.is_verified,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class EmergencyContactDetailView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get_contact(self, request, contact_id):
        try:
            return EmergencyContact.objects.get(
                id=contact_id,
                owner=request.user,
            )
        except EmergencyContact.DoesNotExist:
            return None

    def patch(self, request, contact_id):
        contact = self.get_contact(request, contact_id)

        if contact is None:
            return Response(
                {"error": "Emergency contact not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        for field in ("name", "phone", "relationship"):
            if field in request.data:
                value = str(request.data[field]).strip()

                if not value:
                    return Response(
                        {field: ["This field cannot be empty."]},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if field == "phone":
                    digits = value.replace("+", "")

                    if (
                        not digits.isdigit()
                        or value.count("+") > 1
                        or ("+" in value and not value.startswith("+"))
                        or not 10 <= len(digits) <= 15
                    ):
                        return Response(
                            {"phone": ["Enter a valid phone number."]},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                setattr(contact, field, value)

        # A changed phone number must be verified again.
        if "phone" in request.data:
            contact.is_verified = False

        contact.save()

        return Response(
            {
                "message": "Emergency contact updated successfully.",
                "id": contact.id,
                "name": contact.name,
                "phone": contact.phone,
                "relationship": contact.relationship,
                "is_verified": contact.is_verified,
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request, contact_id):
        contact = self.get_contact(request, contact_id)

        if contact is None:
            return Response(
                {"error": "Emergency contact not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        contact.delete()

        return Response(
            {"message": "Emergency contact deleted successfully."},
            status=status.HTTP_200_OK,
        )


class VolunteerApplicationView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        profile = getattr(request.user, "profile", None)

        if profile is None or profile.role != "volunteer":
            return Response(
                {"error": "Only registered volunteers can apply."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if VolunteerApplication.objects.filter(
            user=request.user
        ).exists():
            return Response(
                {"error": "You have already submitted an application."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = VolunteerApplicationSerializer(
            data=request.data,
            context={"request": request},
        )

        if serializer.is_valid():
            application = serializer.save()
            profile.volunteer_status = "pending"
            profile.save(update_fields=["volunteer_status"])

            return Response(
                {
                    "message": (
                        "Volunteer application submitted successfully."
                    ),
                    "status": application.status,
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )


class GeneratePairingCodeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = getattr(request.user, "profile", None)

        if profile is None or profile.role != "user":
            return Response(
                {
                    "error": (
                        "Only child/user accounts can generate pairing codes."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        existing = ParentChildLink.objects.filter(
            child=request.user
        ).first()

        if existing and existing.parent_id:
            return Response(
                {"error": "This account is already linked to a parent."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        code = None

        for _ in range(5):
            candidate = secrets.token_hex(4).upper()

            if not ParentChildLink.objects.filter(
                pairing_code=candidate
            ).exists():
                code = candidate
                break

        if code is None:
            return Response(
                {
                    "error": (
                        "Could not generate a pairing code. Try again."
                    )
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        link, _ = ParentChildLink.objects.get_or_create(
            child=request.user
        )

        link.pairing_code = code
        link.code_expires_at = timezone.now() + timedelta(minutes=15)
        link.save(update_fields=["pairing_code", "code_expires_at"])

        return Response(
            {
                "message": (
                    "Pairing code generated. Share it only with your parent."
                ),
                "pairing_code": code,
                "expires_in_minutes": 15,
            },
            status=status.HTTP_200_OK,
        )


class LinkChildView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = getattr(request.user, "profile", None)

        if profile is None or profile.role != "parent":
            return Response(
                {"error": "Only parent accounts can link a child."},
                status=status.HTTP_403_FORBIDDEN,
            )

        code = str(
            request.data.get("pairing_code", "")
        ).strip().upper()

        if not code:
            return Response(
                {"error": "pairing_code is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            link = ParentChildLink.objects.select_related(
                "child"
            ).get(pairing_code=code)
        except ParentChildLink.DoesNotExist:
            return Response(
                {"error": "Invalid or expired pairing code."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if (
            not link.code_expires_at
            or link.code_expires_at <= timezone.now()
        ):
            link.pairing_code = None
            link.code_expires_at = None
            link.save(
                update_fields=["pairing_code", "code_expires_at"]
            )

            return Response(
                {"error": "Pairing code expired. Generate a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if link.parent_id:
            return Response(
                {"error": "This child is already linked to a parent."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        link.parent = request.user
        link.pairing_code = None
        link.code_expires_at = None
        link.linked_at = timezone.now()
        link.save(
            update_fields=[
                "parent",
                "pairing_code",
                "code_expires_at",
                "linked_at",
            ]
        )

        return Response(
            {
                "message": "Child linked successfully.",
                "child_username": link.child.username,
            },
            status=status.HTTP_200_OK,
        )


class ParentChildrenView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "profile", None)

        if profile is None or profile.role != "parent":
            return Response(
                {
                    "error": (
                        "Only parent accounts can view linked children."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        links = ParentChildLink.objects.filter(
            parent=request.user
        ).select_related("child").order_by("linked_at")

        return Response(
            [
                {
                    "username": link.child.username,
                    "linked_at": link.linked_at,
                }
                for link in links
            ],
            status=status.HTTP_200_OK,
        )


class EmergencyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyContact
        fields = [
            "id",
            "name",
            "phone",
            "relationship",
            "is_verified",
            "created_at",
        ]
        read_only_fields = ["id", "is_verified", "created_at"]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Contact name is required.")
        return value

    def validate_phone(self, value):
        value = value.strip()
        digits = value.removeprefix("+")
        if not digits.isdigit() or not 10 <= len(digits) <= 15:
            raise serializers.ValidationError("Enter a valid contact number.")
        return value

    def validate_relationship(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Relationship is required.")
        return value


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    role = serializers.CharField(read_only=True)
    verification_status = serializers.CharField(read_only=True)
    phone_verified = serializers.BooleanField(read_only=True)
    profile_photo = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = UserProfile
        fields = [
            "username",
            "email",
            "role",
            "full_name",
            "phone",
            "address",
            "date_of_birth",
            "profile_photo",
            "emergency_contact_name",
            "emergency_contact_phone",
            "emergency_contact_relationship",
            "verification_status",
            "phone_verified",
        ]
        read_only_fields = [
            "username",
            "email",
            "role",
            "verification_status",
            "phone_verified",
        ]

    def validate_phone(self, value):
        value = value.strip()
        digits = value.removeprefix("+")
        if not digits.isdigit() or not 10 <= len(digits) <= 15:
            raise serializers.ValidationError("Enter a valid mobile number.")
        return value

    def validate_date_of_birth(self, value):
        from datetime import date

        if value and value >= date.today():
            raise serializers.ValidationError(
                "Date of birth must be in the past."
            )
        return value

    def update(self, instance, validated_data):
        # Keep account email and username unchanged through this endpoint.
        validated_data.pop("user", None)
        return super().update(instance, validated_data)


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        profile = getattr(request.user, "profile", None)
        if profile is None:
            return Response(
                {"error": "Account profile not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(ProfileSerializer(profile).data)

    def patch(self, request):
        profile = getattr(request.user, "profile", None)
        if profile is None:
            return Response(
                {"error": "Account profile not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ProfileSerializer(
            profile,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class EmergencyContactListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        contacts = EmergencyContact.objects.filter(owner=request.user)
        return Response(EmergencyContactSerializer(contacts, many=True).data)

    def post(self, request):
        serializer = EmergencyContactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(owner=request.user)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
        )


class EmergencyContactDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_contact(self, request, contact_id):
        try:
            return EmergencyContact.objects.get(
                id=contact_id,
                owner=request.user,
            )
        except EmergencyContact.DoesNotExist:
            return None

    def patch(self, request, contact_id):
        contact = self.get_contact(request, contact_id)
        if contact is None:
            return Response(
                {"error": "Emergency contact not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = EmergencyContactSerializer(
            contact,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, contact_id):
        contact = self.get_contact(request, contact_id)
        if contact is None:
            return Response(
                {"error": "Emergency contact not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        contact.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)