from rest_framework import serializers

from games import igdb
from games.models import Game
from games.serializers import GameSerializer
from games.services import import_game

from .models import RATEABLE_STATUSES, UserGameList


class UserGameListSerializer(serializers.ModelSerializer):
    game = GameSerializer(read_only=True)
    # Add by local game id, or by IGDB id (the game is imported on the fly).
    game_id = serializers.PrimaryKeyRelatedField(
        queryset=Game.objects.all(), source="game", write_only=True, required=False
    )
    igdb_id = serializers.IntegerField(write_only=True, required=False, min_value=1)
    review_visible = serializers.BooleanField(read_only=True)

    class Meta:
        model = UserGameList
        fields = [
            "id",
            "game",
            "game_id",
            "igdb_id",
            "status",
            "rating",
            "review",
            "review_visible",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        request = self.context["request"]

        if self.instance is None:
            igdb_id = attrs.pop("igdb_id", None)
            if "game" not in attrs:
                if igdb_id is None:
                    raise serializers.ValidationError({"game_id": "Provide game_id or igdb_id."})
                try:
                    game = import_game(igdb_id)
                except igdb.IGDBError as exc:
                    raise serializers.ValidationError({"igdb_id": f"Game database unavailable: {exc}"})
                if game is None:
                    raise serializers.ValidationError({"igdb_id": "Game not found on IGDB."})
                attrs["game"] = game
            if UserGameList.objects.filter(user=request.user, game=attrs["game"]).exists():
                raise serializers.ValidationError({"game_id": "This game is already in your library."})
        else:
            # The game of an existing entry cannot be changed.
            attrs.pop("igdb_id", None)
            attrs.pop("game", None)

        status = attrs.get("status", getattr(self.instance, "status", None))
        if "review" in attrs and attrs["review"] is not None:
            attrs["review"] = attrs["review"].strip() or None
        sets_rating = attrs.get("rating") is not None
        sets_review = attrs.get("review") is not None
        if (sets_rating or sets_review) and status not in RATEABLE_STATUSES:
            raise serializers.ValidationError(
                {"rating": "Only Completed or Dropped games can be rated or reviewed."}
            )
        return attrs

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)
