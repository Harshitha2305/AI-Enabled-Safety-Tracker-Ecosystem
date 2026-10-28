
import math

from rest_framework import generics
from rest_framework.response import Response

from .models import SensorData
from .serializers import SensorDataSerializer


FALL_THRESHOLD = 18.0


def get_sensor_status(data):
    acceleration_magnitude = math.sqrt(
        data["acceleration_x"] ** 2
        + data["acceleration_y"] ** 2
        + data["acceleration_z"] ** 2
    )

    return {
        "acceleration_magnitude": round(acceleration_magnitude, 2),
        "possible_fall": acceleration_magnitude >= FALL_THRESHOLD,
    }


class SensorDataCreateView(generics.CreateAPIView):
    queryset = SensorData.objects.all()
    serializer_class = SensorDataSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        status = get_sensor_status(serializer.validated_data)
        sensor_record = serializer.save()

        response_data = self.get_serializer(sensor_record).data
        response_data.update(status)

        return Response(response_data, status=201)


class SensorDataListView(generics.ListAPIView):
    queryset = SensorData.objects.all().order_by("-created_at")
    serializer_class = SensorDataSerializer

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)

        for item in response.data:
            item.update(get_sensor_status(item))

        return response
