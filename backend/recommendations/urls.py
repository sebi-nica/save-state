from django.urls import path

from .views import PickNextView, RecommendationsView

urlpatterns = [
    path("", RecommendationsView.as_view()),
    path("next/", PickNextView.as_view()),
]
