from collections import Counter


BLOCK_TYPES = [
    "start",
    "end",
    "ai",
    "condition",
    "action",
    "database",
    "email",
    "log",
    "http",
    "loop",
    "merge",
]


class WorkflowFeatureExtractor:
    def extract(self, workflow: dict, target_block_id: str | None = None) -> dict:
        blocks = workflow.get("blocks", [])
        connections = workflow.get("connections", [])

        blocks_by_id = {
            block.get("id"): block
            for block in blocks
            if block.get("id")
        }

        target_block = self._resolve_target_block(blocks, connections, target_block_id)
        target_block_type = target_block.get("type") if target_block else "none"

        incoming_count = 0
        outgoing_count = 0

        if target_block:
            incoming_count = self._count_incoming(connections, target_block["id"])
            outgoing_count = self._count_outgoing(connections, target_block["id"])

        block_type_counts = Counter(
            block.get("type")
            for block in blocks
            if block.get("type")
        )

        dangling_input_blocks_count = 0
        dangling_output_blocks_count = 0

        for block in blocks:
            block_id = block.get("id")
            block_type = block.get("type")

            if not block_id:
                continue

            if block_type != "start" and self._count_incoming(connections, block_id) == 0:
                dangling_input_blocks_count += 1

            if block_type != "end" and self._count_outgoing(connections, block_id) == 0:
                dangling_output_blocks_count += 1

        position = target_block.get("position", {}) if target_block else {}
        target_position_x = position.get("x", 0) or 0
        target_position_y = position.get("y", 0) or 0

        features = {
            "blocks_count": len(blocks),
            "connections_count": len(connections),
            "has_start": int(block_type_counts["start"] > 0),
            "has_end": int(block_type_counts["end"] > 0),
            "target_has_incoming": int(incoming_count > 0),
            "target_has_outgoing": int(outgoing_count > 0),
            "incoming_count": incoming_count,
            "outgoing_count": outgoing_count,
            "dangling_input_blocks_count": dangling_input_blocks_count,
            "dangling_output_blocks_count": dangling_output_blocks_count,
            "target_position_x": target_position_x,
            "target_position_y": target_position_y,
            "target_block_type": target_block_type,
        }

        for block_type in BLOCK_TYPES:
            features[f"{block_type}_blocks_count"] = block_type_counts[block_type]
            features[f"is_target_{block_type}"] = int(target_block_type == block_type)

        features["is_empty_workflow"] = int(len(blocks) == 0)

        return features

    def _resolve_target_block(
        self,
        blocks: list[dict],
        connections: list[dict],
        target_block_id: str | None,
    ) -> dict | None:
        if not blocks:
            return None

        if target_block_id:
            for block in blocks:
                if block.get("id") == target_block_id:
                    return block

        dangling_output = self._find_first_dangling_output_block(blocks, connections)

        if dangling_output:
            return dangling_output

        return self._get_rightmost_block(blocks)

    def _find_first_dangling_output_block(
        self,
        blocks: list[dict],
        connections: list[dict],
    ) -> dict | None:
        sorted_blocks = sorted(
            blocks,
            key=lambda block: (
                block.get("position", {}).get("x", 0) or 0,
                block.get("position", {}).get("y", 0) or 0,
                block.get("id", ""),
            ),
        )

        for block in sorted_blocks:
            block_id = block.get("id")
            block_type = block.get("type")

            if not block_id or block_type == "end":
                continue

            if self._count_outgoing(connections, block_id) == 0:
                return block

        return None

    def _get_rightmost_block(self, blocks: list[dict]) -> dict:
        return max(
            blocks,
            key=lambda block: (
                block.get("position", {}).get("x", 0) or 0,
                block.get("position", {}).get("y", 0) or 0,
            ),
        )

    def _count_incoming(self, connections: list[dict], block_id: str) -> int:
        return sum(
            1
            for connection in connections
            if connection.get("targetBlockId") == block_id
        )

    def _count_outgoing(self, connections: list[dict], block_id: str) -> int:
        return sum(
            1
            for connection in connections
            if connection.get("sourceBlockId") == block_id
        )
