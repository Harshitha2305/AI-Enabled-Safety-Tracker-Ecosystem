
from django.db import models
from django.contrib.auth.models import User


class Emergency(models.Model):
    STATUS_CHOICES = [
        ("active", "Active"),
        ("assigned", "Volunteer Assigned"),
        ("responding", "Volunteer Responding"),
        ("resolved", "Resolved"),
        ("cancelled", "Cancelled"),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="emergencies",
    )

    description = models.TextField(blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="active",
    )

    assigned_volunteer = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_emergencies",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "SOS Alert"
        verbose_name_plural = "SOS Alerts"

    def __str__(self):
        return f"Emergency #{self.id} - {self.status}"

class EmergencyNotification(models.Model):
    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="emergency_notifications",
    )
    emergency = models.ForeignKey(
        Emergency,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    message = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Notification for {self.recipient.username}: Emergency #{self.emergency_id}"
