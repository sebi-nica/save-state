from rest_framework.routers import SimpleRouter

from .views import LibraryViewSet

router = SimpleRouter()
router.register("", LibraryViewSet, basename="library")

urlpatterns = router.urls
