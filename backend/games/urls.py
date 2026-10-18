from django.urls import path

from . import views

urlpatterns = [
    path("search/", views.GameSearchView.as_view()),
    path("import/", views.GameImportView.as_view()),
    path("<int:pk>/", views.GameDetailView.as_view()),
]
