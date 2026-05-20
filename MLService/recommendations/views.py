from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from recommendations.serializers import (
    NextBlockRecommendationRequestSerializer,
    NextBlockRecommendationResponseSerializer,
)
from recommendations.services import NextBlockRecommendationService


class HealthCheckView(APIView):
    authentication_classes = []
    permission_classes = []

    service = NextBlockRecommendationService()

    def get(self, request):
        return Response(
            {
                "status": "UP",
                "service": "ml-service",
                "version": "0.1.0",
                "classifier": {
                    "trainedModelAvailable": self.service.classifier.is_trained_model_available(),
                },
            }
        )


class NextBlockRecommendationView(APIView):
    authentication_classes = []
    permission_classes = []

    service = NextBlockRecommendationService()

    def post(self, request):
        request_serializer = NextBlockRecommendationRequestSerializer(
            data=request.data,
        )

        if not request_serializer.is_valid():
            return Response(
                {
                    "message": "Invalid recommendation request.",
                    "errors": request_serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        validated_data = request_serializer.validated_data

        recommendations = self.service.recommend(
            workflow=validated_data["workflow"],
            target_block_id=validated_data.get("targetBlockId"),
            limit=validated_data.get("limit", 3),
        )

        response_data = {
            "recommendations": recommendations,
        }

        response_serializer = NextBlockRecommendationResponseSerializer(
            data=response_data,
        )
        response_serializer.is_valid(raise_exception=True)

        return Response(response_serializer.data)
