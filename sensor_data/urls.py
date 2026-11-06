from django.urls import path
from .views import SensorDataCreateView, SensorDataListView
from .views import SoundDataCreateView, LatestSoundDataView


urlpatterns = [
    path('send/', SensorDataCreateView.as_view()),
    path('all/', SensorDataListView.as_view()),
    path('sound/send/', SoundDataCreateView.as_view()),
    path('sound/latest/', LatestSoundDataView.as_view()),
]