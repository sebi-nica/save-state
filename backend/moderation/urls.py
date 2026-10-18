from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("users", views.AdminUserViewSet, basename="admin-users")
router.register("games", views.AdminGameViewSet, basename="admin-games")
router.register("reviews", views.AdminReviewViewSet, basename="admin-reviews")

urlpatterns = router.urls
