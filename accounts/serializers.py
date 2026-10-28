
import os
from datetime import date

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password

from rest_framework import serializers

from .models import UserProfile, VolunteerApplication


class RegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        validators=[validate_password],
    )

    role = serializers.ChoiceField(
        choices=["user", "parent", "volunteer"]
    )

    email = serializers.EmailField(required=True)

    full_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=20)
    address = serializers.CharField()
    date_of_birth = serializers.DateField()

    profile_photo = serializers.ImageField(write_only=True)
    identity_document = serializers.FileField(write_only=True)

    emergency_contact_name = serializers.CharField(max_length=150)
    emergency_contact_phone = serializers.CharField(max_length=20)
    emergency_contact_relationship = serializers.CharField(
        max_length=50
    )

    MAX_FILE_SIZE = 5 * 1024 * 1024

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "password",
            "role",
            "full_name",
            "phone",
            "address",
            "date_of_birth",
            "profile_photo",
            "identity_document",
            "emergency_contact_name",
            "emergency_contact_phone",
            "emergency_contact_relationship",
        ]

    def validate_email(self, value):
        value = value.strip().lower()

        if not value:
            raise serializers.ValidationError(
                "Email is required."
            )

        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )

        return value

    def validate_full_name(self, value):
        value = value.strip()

        if len(value) < 2:
            raise serializers.ValidationError(
                "Enter your full name."
            )

        return value

    def validate_phone(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Mobile number is required."
            )

        if not value.replace("+", "").isdigit() or value.count("+") > 1 or (
            "+" in value and not value.startswith("+")
        ):
            raise serializers.ValidationError(
                "Enter a valid mobile number."
            )

        if len(value.replace("+", "")) < 10 or len(
            value.replace("+", "")
        ) > 15:
            raise serializers.ValidationError(
                "Mobile number must contain 10 to 15 digits."
            )

        return value

    def validate_emergency_contact_phone(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Emergency contact number is required."
            )

        if (
            not value.replace("+", "").isdigit()
            or value.count("+") > 1
            or ("+" in value and not value.startswith("+"))
            or not 10 <= len(value.replace("+", "")) <= 15
        ):
            raise serializers.ValidationError(
                "Enter a valid emergency contact number."
            )

        return value

    def validate_date_of_birth(self, value):
        if value >= date.today():
            raise serializers.ValidationError(
                "Date of birth must be in the past."
            )

        return value

    def validate_profile_photo(self, file):
        self._validate_file(
            file,
            {"jpg", "jpeg", "png"},
        )
        return file

    def validate_identity_document(self, file):
        self._validate_file(
            file,
            {"pdf", "jpg", "jpeg", "png"},
        )
        return file

    def _validate_file(self, file, allowed_extensions):
        extension = os.path.splitext(file.name)[1].lower().lstrip(".")

        if extension not in allowed_extensions:
            raise serializers.ValidationError(
                "Unsupported file type."
            )

        if file.size > self.MAX_FILE_SIZE:
            raise serializers.ValidationError(
                "File size must not exceed 5 MB."
            )

    def validate(self, attrs):
        if not attrs.get("emergency_contact_name", "").strip():
            raise serializers.ValidationError({
                "emergency_contact_name":
                    "Emergency contact name is required."
            })

        if not attrs.get("emergency_contact_relationship", "").strip():
            raise serializers.ValidationError({
                "emergency_contact_relationship":
                    "Emergency contact relationship is required."
            })

        return attrs

    def create(self, validated_data):
        role = validated_data.pop("role")

        full_name = validated_data.pop("full_name")
        phone = validated_data.pop("phone")
        address = validated_data.pop("address")
        date_of_birth = validated_data.pop("date_of_birth")

        profile_photo = validated_data.pop("profile_photo")
        identity_document = validated_data.pop("identity_document")

        emergency_contact_name = validated_data.pop(
            "emergency_contact_name"
        )
        emergency_contact_phone = validated_data.pop(
            "emergency_contact_phone"
        )
        emergency_contact_relationship = validated_data.pop(
            "emergency_contact_relationship"
        )

        first_name, *remaining_name = full_name.split(" ", 1)
        last_name = remaining_name[0] if remaining_name else ""

        user = User.objects.create_user(
            first_name=first_name,
            last_name=last_name,
            **validated_data,
        )

        UserProfile.objects.create(
            user=user,
            role=role,
            volunteer_status=(
                "pending" if role == "volunteer"
                else "not_applicable"
            ),
            full_name=full_name,
            phone=phone,
            address=address,
            date_of_birth=date_of_birth,
            profile_photo=profile_photo,
            identity_document=identity_document,
            emergency_contact_name=emergency_contact_name,
            emergency_contact_phone=emergency_contact_phone,
            emergency_contact_relationship=(
                emergency_contact_relationship
            ),
            verification_status="pending_verification",
            phone_verified=False,
        )

        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )

    def validate(self, attrs):
        user = authenticate(
            username=attrs["username"],
            password=attrs["password"],
        )

        if user is None:
            raise serializers.ValidationError(
                "Invalid username or password."
            )

        if not user.is_active:
            raise serializers.ValidationError(
                "This account is inactive."
            )

        if getattr(user, "profile", None) is None:
            raise serializers.ValidationError(
                "Account profile is missing."
            )

        attrs["user"] = user
        return attrs


class VolunteerApplicationSerializer(serializers.ModelSerializer):
    MAX_FILE_SIZE = 5 * 1024 * 1024

    class Meta:
        model = VolunteerApplication
        fields = [
            "experience",
            "qualifications",
            "government_id",
            "profile_photo",
            "address_proof",
        ]

    def validate_experience(self, value):
        if not value.strip():
            raise serializers.ValidationError(
                "Please describe your relevant experience."
            )
        return value

    def validate_qualifications(self, value):
        if not value.strip():
            raise serializers.ValidationError(
                "Please provide your qualifications or training."
            )
        return value

    def validate_government_id(self, value):
        self._validate_file(value, {"pdf", "jpg", "jpeg", "png"})
        return value

    def validate_profile_photo(self, value):
        self._validate_file(value, {"jpg", "jpeg", "png"})
        return value

    def validate_address_proof(self, value):
        self._validate_file(value, {"pdf", "jpg", "jpeg", "png"})
        return value

    def _validate_file(self, file, allowed_extensions):
        extension = os.path.splitext(file.name)[1].lower().lstrip(".")

        if extension not in allowed_extensions:
            raise serializers.ValidationError(
                "Unsupported file type."
            )

        if file.size > self.MAX_FILE_SIZE:
            raise serializers.ValidationError(
                "File size must not exceed 5 MB."
            )

    def create(self, validated_data):
        return VolunteerApplication.objects.create(
            user=self.context["request"].user,
            **validated_data,
        )
