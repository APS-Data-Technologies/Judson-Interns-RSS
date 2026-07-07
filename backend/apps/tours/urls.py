from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import HomeSummaryView, TourViewSet

router = DefaultRouter()
router.register("tours", TourViewSet, basename="tour")

urlpatterns = [
    path("home/summary/", HomeSummaryView.as_view(), name="home-summary"),
    path("", include(router.urls)),
]
