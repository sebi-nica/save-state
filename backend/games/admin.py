from django.contrib import admin

from .models import Game


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ["title", "igdb_id", "release_date", "created_at"]
    search_fields = ["title"]
