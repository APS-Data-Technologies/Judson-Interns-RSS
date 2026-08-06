from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import LeadSourceListView, LeadSourceViewSet

router = DefaultRouter()
router.register("manage-lead-sources", LeadSourceViewSet, basename="manage-lead-source")

urlpatterns = [
    path("lead-sources/", LeadSourceListView.as_view(), name="lead-source-list"),
    path("", include(router.urls)),
]
