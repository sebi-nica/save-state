from rest_framework import serializers

from .models import Game


class GameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = [
            "id",
            "igdb_id",
            "title",
            "slug",
            "cover_url",
            "summary",
            "release_date",
            "genres",
            "platforms",
            "ttb_hastily",
            "ttb_normally",
            "ttb_completely",
        ]
        read_only_fields = fields
