from django.core.cache import cache
from django.db.models import Avg, Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from library.models import RATEABLE_STATUSES, UserGameList

from . import igdb
from .models import Game
from .serializers import GameSerializer
from .services import import_game

SEARCH_CACHE_SECONDS = 600


def igdb_unavailable(exc):
    return Response({"detail": f"Game database unavailable: {exc}"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class GameSearchView(APIView):
    """Live search against IGDB. Results are annotated with the user's library status."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "search"

    def get(self, request):
        text = request.query_params.get("q", "").strip()
        if len(text) < 2:
            return Response({"results": []})
        cache_key = f"igdb:search:{text.lower()}"
        results = cache.get(cache_key)
        if results is None:
            try:
                results = igdb.search_games(text)
            except igdb.IGDBError as exc:
                return igdb_unavailable(exc)
            cache.set(cache_key, results, SEARCH_CACHE_SECONDS)

        igdb_ids = [r["igdb_id"] for r in results]
        local = dict(Game.objects.filter(igdb_id__in=igdb_ids).values_list("igdb_id", "id"))
        statuses = dict(
            UserGameList.objects.filter(user=request.user, game__igdb_id__in=igdb_ids).values_list(
                "game__igdb_id", "status"
            )
        )
        return Response(
            {
                "results": [
                    {**r, "id": local.get(r["igdb_id"]), "library_status": statuses.get(r["igdb_id"])}
                    for r in results
                ]
            }
        )


class ImportSerializer(serializers.Serializer):
    igdb_id = serializers.IntegerField(min_value=1)


class GameImportView(APIView):
    """Store a selected IGDB game locally (no-op if it is already stored)."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "search"

    def post(self, request):
        serializer = ImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            game = import_game(serializer.validated_data["igdb_id"])
        except igdb.IGDBError as exc:
            return igdb_unavailable(exc)
        if game is None:
            return Response({"detail": "Game not found on IGDB."}, status=status.HTTP_404_NOT_FOUND)
        return Response(GameSerializer(game).data, status=status.HTTP_201_CREATED)


def public_reviews(game):
    """Ratings/reviews visible to everyone: only entries currently Completed or Dropped."""
    return (
        UserGameList.objects.filter(game=game, status__in=RATEABLE_STATUSES, user__is_active=True)
        .filter(Q(rating__isnull=False) | (Q(review__isnull=False) & ~Q(review="")))
        .select_related("user")
        .order_by("-updated_at")
    )


class GameDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        game = get_object_or_404(Game, pk=pk)
        reviews = public_reviews(game)
        stats = reviews.aggregate(average=Avg("rating"), count=Count("rating"))
        my_entry = None
        if request.user.is_authenticated:
            entry = UserGameList.objects.filter(user=request.user, game=game).first()
            if entry:
                my_entry = {
                    "id": entry.id,
                    "status": entry.status,
                    "rating": entry.rating,
                    "review": entry.review,
                }
        return Response(
            {
                "game": GameSerializer(game).data,
                "rating_average": round(stats["average"], 2) if stats["average"] is not None else None,
                "rating_count": stats["count"],
                "reviews": [
                    {
                        "id": r.id,
                        "username": r.user.username,
                        "status": r.status,
                        "rating": r.rating,
                        "review": r.review,
                        "updated_at": r.updated_at,
                    }
                    for r in reviews
                ],
                "my_entry": my_entry,
            }
        )
