from django.test import SimpleTestCase

from recommendations.feature_extractor import WorkflowFeatureExtractor


class WorkflowFeatureExtractorTests(SimpleTestCase):
    def setUp(self):
        self.extractor = WorkflowFeatureExtractor()

    def test_empty_workflow_features(self):
        workflow = {
            "blocks": [],
            "connections": [],
        }

        features = self.extractor.extract(workflow)

        self.assertEqual(features["is_empty_workflow"], 1)
        self.assertEqual(features["blocks_count"], 0)
        self.assertEqual(features["connections_count"], 0)
        self.assertEqual(features["has_start"], 0)
        self.assertEqual(features["has_end"], 0)
        self.assertEqual(features["target_block_type"], "none")
        self.assertEqual(features["last_block_type"], "none")

    def test_start_to_ai_features(self):
        workflow = {
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
                    "position": {
                        "x": 350,
                        "y": 100,
                    },
                    "config": {},
                },
            ],
            "connections": [
                {
                    "id": "conn-1",
                    "sourceBlockId": "start-1",
                    "targetBlockId": "ai-1",
                }
            ],
        }

        features = self.extractor.extract(
            workflow=workflow,
            target_block_id="ai-1",
        )

        self.assertEqual(features["is_empty_workflow"], 0)
        self.assertEqual(features["blocks_count"], 2)
        self.assertEqual(features["connections_count"], 1)
        self.assertEqual(features["has_start"], 1)
        self.assertEqual(features["has_end"], 0)
        self.assertEqual(features["target_block_type"], "ai")
        self.assertEqual(features["previous_block_type"], "start")
        self.assertEqual(features["last_block_type"], "ai")
        self.assertEqual(features["target_has_incoming"], 1)
        self.assertEqual(features["target_has_outgoing"], 0)
        self.assertEqual(features["incoming_count"], 1)
        self.assertEqual(features["outgoing_count"], 0)
        self.assertEqual(features["is_target_ai"], 1)
        self.assertEqual(features["ai_blocks_count"], 1)
        self.assertEqual(features["start_blocks_count"], 1)

    def test_condition_outputs_are_counted(self):
        workflow = {
            "blocks": [
                {
                    "id": "start-1",
                    "type": "start",
                    "position": {
                        "x": 100,
                        "y": 100,
                    },
                },
                {
                    "id": "condition-1",
                    "type": "condition",
                    "position": {
                        "x": 350,
                        "y": 100,
                    },
                },
                {
                    "id": "email-1",
                    "type": "email",
                    "position": {
                        "x": 600,
                        "y": 30,
                    },
                },
                {
                    "id": "log-1",
                    "type": "log",
                    "position": {
                        "x": 600,
                        "y": 190,
                    },
                },
            ],
            "connections": [
                {
                    "id": "conn-1",
                    "sourceBlockId": "start-1",
                    "targetBlockId": "condition-1",
                },
                {
                    "id": "conn-2",
                    "sourceBlockId": "condition-1",
                    "targetBlockId": "email-1",
                },
                {
                    "id": "conn-3",
                    "sourceBlockId": "condition-1",
                    "targetBlockId": "log-1",
                },
            ],
        }

        features = self.extractor.extract(
            workflow=workflow,
            target_block_id="condition-1",
        )

        self.assertEqual(features["target_block_type"], "condition")
        self.assertEqual(features["outgoing_count"], 2)
        self.assertEqual(features["condition_blocks_with_one_output"], 0)
        self.assertEqual(features["condition_blocks_with_two_or_more_outputs"], 1)

    def test_resolves_first_dangling_output_when_target_is_missing(self):
        workflow = {
            "blocks": [
                {
                    "id": "start-1",
                    "type": "start",
                    "position": {
                        "x": 100,
                        "y": 100,
                    },
                },
                {
                    "id": "http-1",
                    "type": "http",
                    "position": {
                        "x": 350,
                        "y": 100,
                    },
                },
            ],
            "connections": [
                {
                    "id": "conn-1",
                    "sourceBlockId": "start-1",
                    "targetBlockId": "http-1",
                }
            ],
        }

        features = self.extractor.extract(workflow=workflow)

        self.assertEqual(features["target_block_type"], "http")
        self.assertEqual(features["target_has_incoming"], 1)
        self.assertEqual(features["target_has_outgoing"], 0)
