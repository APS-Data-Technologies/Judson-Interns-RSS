from django.urls import path

from .views import CohortAnalyticsView


urlpatterns = [
    path("analytics/cohort/", CohortAnalyticsView.as_view(), name="analytics-cohort"),
]
