from rest_framework import serializers
from .models import SensorData, SoundData


class SensorDataSerializer(serializers.ModelSerializer):

    class Meta:
        model = SensorData
        fields = '__all__'

class SoundDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = SoundData
        fields = '__all__'