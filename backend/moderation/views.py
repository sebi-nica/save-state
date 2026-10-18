"""Admin-only API backing the React admin pages."""

from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from games import igdb
from games.models import Game
from games.serializers import GameSerializer
from games.services import upsert_game
from library.models import UserGameList

User = get_user_model()


class AdminPagination(PageNumberPagination):
    page_size = 20


class AdminUserSerializer(serializers.ModelSerializer):
    library_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "is_active", "is_staff", "is_superuser", "date_joined", "last_login", "library_count"]
        read_only_fields = ["id", "username", "email", "is_superuser", "date_joined", "last_login", "library_count"]


class AdminUserViewSet(
    mixins.ListModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    permission_classes = [IsAdminUser]
    serializer_class = AdminUserSerializer
    pagination_class = AdminPagination
    http_method_names = ["get", "patch", "delete"]

    def get_queryset(self):
        qs = User.objects.annotate(library_count=Count("library")).order_by("-date_joined")
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(Q(username__icontains=search) | Q(email__icontains=search))
        return qs

    def _guard(self, user):
        if user == self.request.user:
            return Response({"detail": "You cannot change or delete your own account here."}, status=status.HTTP_400_BAD_REQUEST)
        if user.is_superuser and not self.request.user.is_superuser:
            return Response({"detail": "Only superusers can modify superusers."}, status=status.HTTP_403_FORBIDDEN)
        return None

    def partial_update(self, request, *args, **kwargs):
        return self._guard(self.get_object()) or super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        return self._guard(self.get_object()) or super().destroy(request, *args, **kwargs)


class AdminGameSerializer(GameSerializer):
    entry_count = serializers.IntegerField(read_only=True)

    class Meta(GameSerializer.Meta):
        fields = GameSerializer.Meta.fields + ["entry_count", "created_at"]
        read_only_fields = fields


class AdminGameViewSet(mixins.ListModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = AdminGameSerializer
    pagination_class = AdminPagination

    def get_queryset(self):
        qs = Game.objects.annotate(entry_count=Count("entries")).order_by("-created_at")
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(title__icontains=search)
        return qs

    @action(detail=True, methods=["post"])
    def resync(self, request, pk=None):
        game = self.get_object()
        try:
            data = igdb.get_game(game.igdb_id)
        except igdb.IGDBError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if data is None:
            return Response({"detail": "Game no longer exists on IGDB."}, status=status.HTTP_404_NOT_FOUND)
        game = upsert_game(data)
        return Response(self.get_serializer(self.get_queryset().get(pk=game.pk)).data)


class AdminReviewSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    game_title = serializers.CharField(source="game.title", read_only=True)
    game_id = serializers.IntegerField(source="game.id", read_only=True)

    class Meta:
        model = UserGameList
        fields = ["id", "username", "game_id", "game_title", "status", "rating", "review", "updated_at"]
        read_only_fields = fields


class AdminReviewViewSet(mixins.ListModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Entries that carry a rating or review. Deleting clears the rating/review, not the entry."""

    permission_classes = [IsAdminUser]
    serializer_class = AdminReviewSerializer
    pagination_class = AdminPagination

    def get_queryset(self):
        qs = (
            UserGameList.objects.filter(Q(rating__isnull=False) | (Q(review__isnull=False) & ~Q(review="")))
            .select_related("user", "game")
            .order_by("-updated_at")
        )
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(user__username__icontains=search) | Q(game__title__icontains=search) | Q(review__icontains=search)
            )
        return qs

    def destroy(self, request, *args, **kwargs):
        entry = self.get_object()
        entry.rating = None
        entry.review = None
        entry.save(update_fields=["rating", "review", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)
