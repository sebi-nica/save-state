from rest_framework import viewsets

from .models import Status, UserGameList
from .serializers import UserGameListSerializer


class LibraryViewSet(viewsets.ModelViewSet):
    """The current user's tracked games. Filter with ?status=Playing|Backlog|Completed|Dropped."""

    serializer_class = UserGameListSerializer
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        qs = UserGameList.objects.filter(user=self.request.user).select_related("game")
        status = self.request.query_params.get("status")
        if status in Status.values:
            qs = qs.filter(status=status)
        return qs
