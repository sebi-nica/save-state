from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q


class Status(models.TextChoices):
    PLAYING = "Playing"
    BACKLOG = "Backlog"
    COMPLETED = "Completed"
    DROPPED = "Dropped"


# Only these statuses may carry a rating/review. Entries moved to another status keep their
# rating/review, but it is hidden from public views and ignored by the recommender.
RATEABLE_STATUSES = (Status.COMPLETED, Status.DROPPED)


class UserGameList(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="library")
    game = models.ForeignKey("games.Game", on_delete=models.CASCADE, related_name="entries")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.BACKLOG)
    rating = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    review = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "game"], name="unique_user_game"),
            models.CheckConstraint(
                condition=Q(rating__isnull=True) | Q(rating__gte=1, rating__lte=5),
                name="rating_between_1_and_5",
            ),
        ]

    def __str__(self):
        return f"{self.user} - {self.game} ({self.status})"

    @property
    def review_visible(self):
        return self.status in RATEABLE_STATUSES
