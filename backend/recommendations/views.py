from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

import random

from games.serializers import GameSerializer
from library.serializers import UserGameListSerializer

from .services import pick_next, recommend


class RecommendationsView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "recs"

    def get(self, request):
        data = recommend(request.user)
        for item in data["results"]:
            item["game"] = GameSerializer(item["game"]).data
        return Response(data)


def int_param(request, name, low, high):
    try:
        value = int(request.query_params.get(name, ""))
    except ValueError:
        return None
    return value if low <= value <= high else None


class PickNextView(APIView):
    """GET /api/recommendations/next/?max_hours=10&count=3 - weighted random picks from the Backlog."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "recs"

    def get(self, request):
        seed = int_param(request, "seed", 0, 2**31)
        data = pick_next(
            request.user,
            count=int_param(request, "count", 1, 10) or 3,
            max_hours=int_param(request, "max_hours", 1, 1000),
            rng=random.Random(seed) if seed is not None else None,
        )
        context = {"request": request}
        data["results"] = [
            {"entry": UserGameListSerializer(item["entry"], context=context).data, "matched_genres": item["matched_genres"]}
            for item in data["results"]
        ]
        return Response(data)
