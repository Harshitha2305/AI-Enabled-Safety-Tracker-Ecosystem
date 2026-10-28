from django.contrib import admin
from .models import Emergency


@admin.register(Emergency)
class EmergencyAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "status",
        "assigned_volunteer",
        "created_at",
    )

    list_filter = ("status", "created_at")
    search_fields = ("user__username", "description")
    readonly_fields = ("created_at", "updated_at")