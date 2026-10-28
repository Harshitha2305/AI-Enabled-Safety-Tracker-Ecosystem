from django.urls import path
from .views import SensorDataCreateView, SensorDataListView


urlpatterns = [
    path('send/', SensorDataCreateView.as_view()),
    path('all/', SensorDataListView.as_view()),
]