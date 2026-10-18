from rest_framework.response import Response
from rest_framework.views import APIView

from games.serializers import GameSerializer

from .services import recommend


class RecommendationsView(APIView):
    def get(self, request):
        data = recommend(request.user)
        for item in data["results"]:
            item["game"] = GameSerializer(item["game"]).data
        return Response(data)
