from unittest.mock import patch

from django.test import SimpleTestCase

from recommendations.classifier import BlockClassifier, RuleBasedBlockClassifier


class RuleBasedBlockClassifierTests(SimpleTestCase):
    def setUp(self):
        self.classifier = RuleBasedBlockClassifier()

    def test_predicts_start_for_empty_workflow(self):
        features = {
            "is_empty_workflow": 1,
            "has_start": 0,
            "has_end": 0,
            "target_block_type": "none",
        }

        block_type, confidence = self.classifier.predict(features)

        self.assertEqual(block_type, "start")
        self.assertGreaterEqual(confidence, 0)
        self.assertLessEqual(confidence, 100)

    def test_predicts_log_after_ai(self):
        features = {
            "is_empty_workflow": 0,
            "has_start": 1,
            "has_end": 0,
            "target_block_type": "ai",
        }

        block_type, confidence = self.classifier.predict(features)

        self.assertEqual(block_type, "log")
        self.assertGreaterEqual(confidence, 0)
        self.assertLessEqual(confidence, 100)

    def test_predicts_condition_after_http(self):
        features = {
            "is_empty_workflow": 0,
            "has_start": 1,
            "has_end": 0,
            "target_block_type": "http",
        }

        block_type, confidence = self.classifier.predict(features)

        self.assertEqual(block_type, "condition")
        self.assertGreaterEqual(confidence, 0)
        self.assertLessEqual(confidence, 100)


class BlockClassifierFallbackTests(SimpleTestCase):
    def test_uses_rule_based_fallback_when_models_are_unavailable(self):
        with patch.object(BlockClassifier, "_load_ensemble_classifier", return_value=None), \
             patch.object(BlockClassifier, "_load_legacy_classifier", return_value=None):
            classifier = BlockClassifier()

        features = {
            "is_empty_workflow": 0,
            "has_start": 1,
            "has_end": 0,
            "target_block_type": "ai",
        }

        block_type, confidence = classifier.predict(
            features=features,
            workflow_text="target block type ai prompt summarize text",
        )

        self.assertEqual(classifier.get_runtime_mode(), "rule-based")
        self.assertEqual(classifier.get_model_names(), ["rule_based"])
        self.assertEqual(block_type, "log")
        self.assertGreaterEqual(confidence, 0)
        self.assertLessEqual(confidence, 100)
