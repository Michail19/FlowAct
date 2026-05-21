from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITestCase

from recommendations.classifier import BlockClassifier, RuleBasedBlockClassifier
from recommendations.views import NextBlockRecommendationView


class RecommendationApiTests(APITestCase):
    def setUp(self):
        self.health_url = "/api/v1/health/"
        self.recommendation_url = "/api/v1/recommendations/next-block/"

    def test_health_endpoint_returns_status(self):
        response = self.client.get(self.health_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "UP")
        self.assertEqual(response.data["service"], "ml-service")
        self.assertIn("classifier", response.data)
        self.assertIn("runtimeMode", response.data["classifier"])
        self.assertIn("models", response.data["classifier"])

    def test_recommendation_endpoint_returns_start_for_empty_workflow(self):
        payload = {
            "workflow": {
                "blocks": [],
                "connections": [],
            },
            "targetBlockId": None,
            "limit": 3,
        }

        response = self.client.post(
            self.recommendation_url,
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("recommendations", response.data)
        self.assertEqual(len(response.data["recommendations"]), 1)

        recommendation = response.data["recommendations"][0]

        self.assertEqual(recommendation["kind"], "next-block")
        self.assertEqual(recommendation["source"], "ai")
        self.assertEqual(recommendation["blockType"], "start")
        self.assertIn("confidence", recommendation)
        self.assertIn("reason", recommendation)
        self.assertIn("proposedConfig", recommendation)

    def test_recommendation_endpoint_returns_log_after_ai_when_fallback_is_used(self):
        payload = {
            "workflow": {
                "blocks": [
                    {
                        "id": "start-1",
                        "type": "start",
                        "title": "Старт",
                        "position": {
                            "x": 100,
                            "y": 100,
                        },
                        "config": {},
                    },
                    {
                        "id": "ai-1",
                        "type": "ai",
                        "title": "AI-функция",
                        "description": "Анализ текста",
                        "position": {
                            "x": 350,
                            "y": 100,
                        },
                        "config": {
                            "ai": {
                                "prompt": "Проанализируй текст и подготовь сообщение",
                            }
                        },
                    },
                ],
                "connections": [
                    {
                        "id": "conn-1",
                        "sourceBlockId": "start-1",
                        "targetBlockId": "ai-1",
                    }
                ],
            },
            "targetBlockId": "ai-1",
            "limit": 3,
        }

        with patch.object(
                NextBlockRecommendationView.service,
                "classifier",
                RuleBasedBlockClassifier(),
        ):
            response = self.client.post(
                self.recommendation_url,
                payload,
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        recommendation = response.data["recommendations"][0]

        self.assertEqual(recommendation["blockType"], "log")
        self.assertEqual(recommendation["targetBlockId"], "ai-1")
        self.assertEqual(recommendation["targetBlockTitle"], "AI-функция")
        self.assertEqual(recommendation["source"], "ai")
        self.assertIn("confidence", recommendation)
        self.assertIn("reason", recommendation)

    def test_recommendation_endpoint_returns_400_for_invalid_connection(self):
        payload = {
            "workflow": {
                "blocks": [
                    {
                        "id": "start-1",
                        "type": "start",
                        "title": "Старт",
                        "position": {
                            "x": 100,
                            "y": 100,
                        },
                        "config": {},
                    }
                ],
                "connections": [
                    {
                        "id": "conn-1"
                    }
                ],
            },
            "targetBlockId": "start-1",
            "limit": 3,
        }

        response = self.client.post(
            self.recommendation_url,
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("errors", response.data)

    def test_recommendation_endpoint_rejects_unknown_block_type(self):
        payload = {
            "workflow": {
                "blocks": [
                    {
                        "id": "unknown-1",
                        "type": "unknown",
                        "title": "Неизвестный блок",
                        "position": {
                            "x": 100,
                            "y": 100,
                        },
                        "config": {},
                    }
                ],
                "connections": [],
            },
            "targetBlockId": "unknown-1",
            "limit": 3,
        }

        response = self.client.post(
            self.recommendation_url,
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("errors", response.data)
