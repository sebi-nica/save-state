from django.db import models


class Game(models.Model):
    """Master list of games pulled from IGDB. Rows are created only when a user selects a game
    (or the recommender caches a suggestion), so the table grows with relevant data only.

    `genres` and `platforms` are JSON lists of {"id": <igdb id>, "name": <str>}.
    """

    igdb_id = models.PositiveIntegerField(unique=True)
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, blank=True)
    cover_url = models.URLField(max_length=500, blank=True)
    summary = models.TextField(blank=True)
    release_date = models.DateField(null=True, blank=True)
    genres = models.JSONField(default=list, blank=True)
    platforms = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["title"]

    def __str__(self):
        return self.title
