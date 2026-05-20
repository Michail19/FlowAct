from django.urls import path

from recommendations.views import (
    HealthCheckView,
    NextBlockRecommendationView,
)


urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="health"),
    path(
        "recommendations/next-block/",
        NextBlockRecommendationView.as_view(),
        name="recommend-next-block",
    ),
]
