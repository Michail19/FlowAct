from recommendations.block_types import BLOCK_TITLES, RECOMMENDATION_TEMPLATES


class RecommendationResponseBuilder:
    def build_next_block_recommendation(
        self,
        block_type: str,
        confidence: int,
        workflow: dict,
        target_block_id: str | None,
    ) -> dict:
        target_block = self._find_block(workflow, target_block_id)

        template = RECOMMENDATION_TEMPLATES.get(
            block_type,
            {
                "reason": "Модель рекомендует добавить этот блок как следующий шаг рабочего процесса.",
                "proposedConfig": {},
            },
        )

        recommendation_id = self._build_recommendation_id(
            block_type=block_type,
            target_block_id=target_block_id,
        )

        recommendation = {
            "id": recommendation_id,
            "kind": "next-block",
            "source": "ai",
            "blockType": block_type,
            "confidence": confidence,
            "reason": template["reason"],
            "proposedConfig": template.get("proposedConfig", {}),
        }

        if target_block:
            recommendation["targetBlockId"] = target_block.get("id")
            recommendation["targetBlockTitle"] = (
                target_block.get("title")
                or BLOCK_TITLES.get(target_block.get("type"), "Блок")
            )

        return recommendation

    def _find_block(self, workflow: dict, block_id: str | None) -> dict | None:
        if not block_id:
            return None

        for block in workflow.get("blocks", []):
            if block.get("id") == block_id:
                return block

        return None

    def _build_recommendation_id(
        self,
        block_type: str,
        target_block_id: str | None,
    ) -> str:
        if target_block_id:
            return f"ml:next-block:{target_block_id}:{block_type}"

        return f"ml:next-block:workflow:{block_type}"
