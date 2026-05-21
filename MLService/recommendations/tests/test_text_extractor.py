from django.test import SimpleTestCase

from recommendations.text_extractor import WorkflowTextExtractor


class WorkflowTextExtractorTests(SimpleTestCase):
    def setUp(self):
        self.extractor = WorkflowTextExtractor()

    def test_extracts_basic_block_text(self):
        workflow = {
            "blocks": [
                {
                    "id": "ai-1",
                    "type": "ai",
                    "title": "AI-функция",
                    "description": "Анализирует текст пользователя",
                    "position": {
                        "x": 100,
                        "y": 100,
                    },
                    "config": {},
                }
            ],
            "connections": [],
        }

        text = self.extractor.extract(
            workflow=workflow,
            target_block_id="ai-1",
        )

        self.assertIn("workflow blocks count 1", text)
        self.assertIn("target block", text)
        self.assertIn("type ai", text)
        self.assertIn("title ai функция", text)
        self.assertIn("description анализирует текст пользователя", text)

    def test_extracts_nested_config_text(self):
        workflow = {
            "blocks": [
                {
                    "id": "http-1",
                    "type": "http",
                    "title": "HTTP-запрос",
                    "position": {
                        "x": 100,
                        "y": 100,
                    },
                    "config": {
                        "http": {
                            "method": "POST",
                            "url": "https://api.example.com/orders",
                            "body": "{\"status\":\"new\"}",
                        }
                    },
                }
            ],
            "connections": [],
        }

        text = self.extractor.extract(
            workflow=workflow,
            target_block_id="http-1",
        )

        self.assertIn("method post", text)
        self.assertIn("url https://api.example.com/orders", text)
        self.assertIn("body", text)
        self.assertIn("status", text)

    def test_extracts_email_and_database_text(self):
        workflow = {
            "blocks": [
                {
                    "id": "database-1",
                    "type": "database",
                    "title": "База данных",
                    "position": {
                        "x": 100,
                        "y": 100,
                    },
                    "config": {
                        "database": {
                            "operation": "select",
                            "query": "select email from users",
                        }
                    },
                },
                {
                    "id": "email-1",
                    "type": "email",
                    "title": "Email",
                    "position": {
                        "x": 350,
                        "y": 100,
                    },
                    "config": {
                        "email": {
                            "subject": "FlowAct notification",
                            "body": "Result: {{input}}",
                        }
                    },
                },
            ],
            "connections": [
                {
                    "id": "conn-1",
                    "sourceBlockId": "database-1",
                    "targetBlockId": "email-1",
                }
            ],
        }

        text = self.extractor.extract(
            workflow=workflow,
            target_block_id="email-1",
        )

        self.assertIn("operation select", text)
        self.assertIn("query select email from users", text)
        self.assertIn("subject flowact notification", text)
        self.assertIn("body result", text)

    def test_limits_text_length(self):
        workflow = {
            "blocks": [
                {
                    "id": "ai-1",
                    "type": "ai",
                    "title": "AI",
                    "position": {
                        "x": 100,
                        "y": 100,
                    },
                    "config": {
                        "ai": {
                            "prompt": "очень длинный текст " * 100,
                        }
                    },
                }
            ],
            "connections": [],
        }

        text = self.extractor.extract(
            workflow=workflow,
            target_block_id="ai-1",
            max_text_length=50,
        )

        self.assertLessEqual(len(text), 50)
