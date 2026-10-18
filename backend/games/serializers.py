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
        ]
        read_only_fields = fields
