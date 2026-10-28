
from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):
    ROLE_CHOICES = [
        ("user", "User"),
        ("parent", "Parent"),
        ("volunteer", "Volunteer"),
    ]

    VOLUNTEER_STATUS_CHOICES = [
        ("not_applicable", "Not Applicable"),
        ("pending", "Pending Approval"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]

    VERIFICATION_STATUS_CHOICES = [
        ("incomplete", "Incomplete"),
        ("pending_verification", "Pending Verification"),
        ("verified", "Verified"),
        ("rejected", "Rejected"),
        ("suspended", "Suspended"),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default="user",
    )

    volunteer_status = models.CharField(
        max_length=20,
        choices=VOLUNTEER_STATUS_CHOICES,
        default="not_applicable",
    )

    # Required profile information.
    full_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    date_of_birth = models.DateField(null=True, blank=True)

    profile_photo = models.ImageField(
        upload_to="profile_photos/",
        null=True,
        blank=True,
    )

    identity_document = models.FileField(
        upload_to="identity_documents/",
        null=True,
        blank=True,
    )

    # Primary emergency contact.
    emergency_contact_name = models.CharField(
        max_length=150,
        blank=True,
    )
    emergency_contact_phone = models.CharField(
        max_length=20,
        blank=True,
    )
    emergency_contact_relationship = models.CharField(
        max_length=50,
        blank=True,
    )

    verification_status = models.CharField(
        max_length=30,
        choices=VERIFICATION_STATUS_CHOICES,
        default="incomplete",
    )

    phone_verified = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.role}"


class EmergencyContact(models.Model):
    """Additional trusted contacts for a user, parent, or volunteer."""

    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="emergency_contacts",
    )

    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20)
    relationship = models.CharField(max_length=50)

    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.name} - {self.owner.username}"


class ParentChildLink(models.Model):
    """One parent can link multiple children; each child can link one parent."""

    child = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="parent_link",
    )

    parent = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="linked_children",
        null=True,
        blank=True,
    )

    pairing_code = models.CharField(
        max_length=8,
        unique=True,
        null=True,
        blank=True,
    )

    code_expires_at = models.DateTimeField(null=True, blank=True)
    linked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        if self.parent_id:
            return f"{self.parent.username} -> {self.child.username}"
        return f"Pairing pending for {self.child.username}"


class VolunteerApplication(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending Review"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="volunteer_application",
    )

    experience = models.TextField()
    qualifications = models.TextField()

    government_id = models.FileField(
        upload_to="volunteer_documents/government_ids/"
    )

    profile_photo = models.ImageField(
        upload_to="volunteer_documents/profile_photos/"
    )

    address_proof = models.FileField(
        upload_to="volunteer_documents/address_proofs/"
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
    )

    admin_notes = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} - {self.status}"
