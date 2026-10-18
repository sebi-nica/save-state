from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from games.serializers import GameSerializer

from .services import recommend


class RecommendationsView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "recs"

    def get(self, request):
        data = recommend(request.user)
        for item in data["results"]:
            item["game"] = GameSerializer(item["game"]).data
        return Response(data)
