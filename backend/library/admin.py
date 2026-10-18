from django.contrib import admin

from .models import UserGameList


@admin.register(UserGameList)
class UserGameListAdmin(admin.ModelAdmin):
    list_display = ["user", "game", "status", "rating", "updated_at"]
    list_filter = ["status"]
    search_fields = ["user__username", "game__title"]
