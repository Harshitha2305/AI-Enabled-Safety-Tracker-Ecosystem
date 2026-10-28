from django.contrib import admin
from django.utils import timezone
from .models import UserProfile, VolunteerApplication

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "role",
        "volunteer_status",
        "phone",
        "created_at",
    )

    list_filter = ("role", "volunteer_status")
    search_fields = ("user__username", "user__email", "phone")
    list_editable = ("volunteer_status",)
    

@admin.register(VolunteerApplication)
class VolunteerApplicationAdmin(admin.ModelAdmin):
    list_display = ("user", "status", "submitted_at", "reviewed_at")
    list_filter = ("status", "submitted_at")
    search_fields = ("user__username", "user__email")
    readonly_fields = ("submitted_at", "reviewed_at")

    def save_model(self, request, obj, form, change):
        if change and "status" in form.changed_data:
            obj.reviewed_at = timezone.now()

        super().save_model(request, obj, form, change)

        profile = obj.user.profile

        if obj.status == "approved":
            profile.volunteer_status = "approved"
        elif obj.status == "rejected":
            profile.volunteer_status = "rejected"
        elif obj.status == "pending":
            profile.volunteer_status = "pending"

        profile.save(update_fields=["volunteer_status"])
