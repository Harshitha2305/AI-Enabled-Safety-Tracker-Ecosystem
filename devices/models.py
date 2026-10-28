from django.db import models


class Device(models.Model):
    device_id = models.CharField(max_length=100, unique=True)
    device_name = models.CharField(max_length=100)
    owner_name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.device_id