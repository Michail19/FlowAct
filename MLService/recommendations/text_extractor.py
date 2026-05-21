import json
import re
from typing import Any


class WorkflowTextExtractor:
    """
    Извлекает текстовое описание workflow для текстовой модели.

    Используется будущей моделью:
    TF-IDF + LogisticRegression

    На вход получает workflow:
    {
        "blocks": [...],
        "connections": [...]
    }

    На выходе возвращает одну строку, собранную из:
    - title;
    - subtitle;
    - description;
    - config;
    - текстовых полей конкретных блоков.
    """

    DEFAULT_MAX_TEXT_LENGTH = 20_000

    TEXT_CONFIG_KEYS = {
        "prompt",
        "systemPrompt",
        "messageTemplate",
        "url",
        "body",
        "headers",
        "subject",
        "recipient",
        "query",
        "payload",
        "parameters",
        "tableName",
        "leftValue",
        "operator",
        "rightValue",
        "collectionPath",
        "itemName",
        "method",
        "operation",
        "actionType",
        "level",
        "mode",
        "responseMode",
    }

    BLOCK_TEXT_FIELDS = {
        "title",
        "subtitle",
        "description",
        "type",
    }

    def extract(
        self,
        workflow: dict,
        target_block_id: str | None = None,
        max_text_length: int = DEFAULT_MAX_TEXT_LENGTH,
    ) -> str:
        blocks = workflow.get("blocks", [])
        connections = workflow.get("connections", [])

        text_parts: list[str] = []

        text_parts.append(self._build_workflow_summary(blocks, connections))

        for block in self._sort_blocks_by_position(blocks):
            block_text = self._extract_block_text(block)

            if block.get("id") == target_block_id:
                block_text = f"target block {block_text}"

            if block_text:
                text_parts.append(block_text)

        result = self._normalize_text(" ".join(text_parts))

        if len(result) > max_text_length:
            return result[:max_text_length]

        return result

    def _build_workflow_summary(
        self,
        blocks: list[dict],
        connections: list[dict],
    ) -> str:
        block_types = [
            str(block.get("type"))
            for block in blocks
            if block.get("type")
        ]

        sequence = " ".join(block_types)

        return (
            f"workflow blocks count {len(blocks)} "
            f"connections count {len(connections)} "
            f"block sequence {sequence}"
        )

    def _extract_block_text(self, block: dict) -> str:
        text_parts: list[str] = []

        for field_name in self.BLOCK_TEXT_FIELDS:
            field_value = block.get(field_name)

            if field_value:
                text_parts.append(f"{field_name} {field_value}")

        config = block.get("config")

        if config:
            text_parts.append(self._extract_config_text(config))

        return self._normalize_text(" ".join(text_parts))

    def _extract_config_text(self, value: Any, parent_key: str | None = None) -> str:
        if value is None:
            return ""

        if isinstance(value, str):
            if not value.strip():
                return ""

            if parent_key and parent_key in self.TEXT_CONFIG_KEYS:
                return f"{parent_key} {value}"

            return value

        if isinstance(value, (int, float, bool)):
            if parent_key and parent_key in self.TEXT_CONFIG_KEYS:
                return f"{parent_key} {value}"

            return str(value)

        if isinstance(value, list):
            return " ".join(
                self._extract_config_text(item, parent_key=parent_key)
                for item in value
            )

        if isinstance(value, dict):
            text_parts: list[str] = []

            for key, nested_value in value.items():
                normalized_key = str(key)

                if normalized_key in self.TEXT_CONFIG_KEYS:
                    text_parts.append(normalized_key)

                text_parts.append(
                    self._extract_config_text(
                        nested_value,
                        parent_key=normalized_key,
                    )
                )

            return " ".join(text_parts)

        try:
            return json.dumps(value, ensure_ascii=False)
        except TypeError:
            return str(value)

    def _sort_blocks_by_position(self, blocks: list[dict]) -> list[dict]:
        return sorted(
            blocks,
            key=lambda block: (
                block.get("position", {}).get("x", 0) or 0,
                block.get("position", {}).get("y", 0) or 0,
                block.get("id", ""),
            ),
        )

    def _normalize_text(self, text: str) -> str:
        normalized_text = text.lower()
        normalized_text = normalized_text.replace("_", " ")
        normalized_text = normalized_text.replace("-", " ")
        normalized_text = re.sub(r"[^\wа-яА-ЯёЁ:/?.=&]+", " ", normalized_text)
        normalized_text = re.sub(r"\s+", " ", normalized_text)

        return normalized_text.strip()
