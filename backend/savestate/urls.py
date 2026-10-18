from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def health(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/health/", health),
    path("api/auth/", include("accounts.urls")),
    path("api/games/", include("games.urls")),
    path("api/library/", include("library.urls")),
    path("api/recommendations/", include("recommendations.urls")),
    path("api/admin/", include("moderation.urls")),
]
