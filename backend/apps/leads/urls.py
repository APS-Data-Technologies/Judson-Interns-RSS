from django.urls import path

from .views import LeadSourceListView

urlpatterns = [
    path("lead-sources/", LeadSourceListView.as_view(), name="lead-source-list"),
]
