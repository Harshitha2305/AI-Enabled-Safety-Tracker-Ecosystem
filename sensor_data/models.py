from django.db import models


class SensorData(models.Model):
    device_id = models.CharField(max_length=100)

    acceleration_x = models.FloatField()
    acceleration_y = models.FloatField()
    acceleration_z = models.FloatField()

    gyro_x = models.FloatField()
    gyro_y = models.FloatField()
    gyro_z = models.FloatField()

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.device_id} - {self.created_at}"

class SoundData(models.Model):
    device_id = models.CharField(max_length=100)
    sound_raw = models.IntegerField(default=0)
    sound_peak_to_peak = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.device_id} - {self.sound_peak_to_peak}"