from django.test import SimpleTestCase

from training.generate_dataset import (
    CASE_ID_COLUMN,
    TARGET_COLUMN,
    WORKFLOW_TEXT_COLUMN,
    build_dataset_rows,
    generate_synthetic_cases,
)


class GenerateDatasetTests(SimpleTestCase):
    def test_build_dataset_rows_adds_structural_and_text_features(self):
        cases = [
            {
                "caseId": "ai_to_log",
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
                            "position": {
                                "x": 350,
                                "y": 100,
                            },
                            "config": {
                                "ai": {
                                    "prompt": "Сделай краткое резюме текста",
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
                "recommendedBlockType": "log",
            }
        ]

        rows = build_dataset_rows(cases)

        self.assertEqual(len(rows), 1)

        row = rows[0]

        self.assertEqual(row[CASE_ID_COLUMN], "ai_to_log")
        self.assertEqual(row[TARGET_COLUMN], "log")
        self.assertIn(WORKFLOW_TEXT_COLUMN, row)

        self.assertEqual(row["blocks_count"], 2)
        self.assertEqual(row["connections_count"], 1)
        self.assertEqual(row["target_block_type"], "ai")
        self.assertEqual(row["is_target_ai"], 1)
        self.assertIn("prompt сделай краткое резюме текста", row[WORKFLOW_TEXT_COLUMN])

    def test_generate_synthetic_cases_returns_cases_with_expected_shape(self):
        cases = generate_synthetic_cases(
            synthetic_repeats=1,
            seed=42,
        )

        self.assertGreater(len(cases), 0)

        first_case = cases[0]

        self.assertIn("caseId", first_case)
        self.assertIn("workflow", first_case)
        self.assertIn("targetBlockId", first_case)
        self.assertIn("recommendedBlockType", first_case)
        self.assertIn("blocks", first_case["workflow"])
        self.assertIn("connections", first_case["workflow"])
