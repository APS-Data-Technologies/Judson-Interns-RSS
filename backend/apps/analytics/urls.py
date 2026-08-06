from django.urls import path

from .views import AnalyticsDrillThroughView, AnalyticsExportView, CohortAnalyticsView, GlobalSearchView


urlpatterns = [
    path("analytics/cohort/", CohortAnalyticsView.as_view(), name="analytics-cohort"),
    path("analytics/export/", AnalyticsExportView.as_view(), name="analytics-export"),
    path("analytics/drill-through/", AnalyticsDrillThroughView.as_view(), name="analytics-drill-through"),
    path("search/global/", GlobalSearchView.as_view(), name="global-search"),
]
