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

        target_block = self._resolve_target_block(
            blocks=blocks,
            connections=connections,
            target_block_id=target_block_id,
        )

        target_block_type = target_block.get("type") if target_block else "none"
        target_block_id = target_block.get("id") if target_block else None

        incoming_count = 0
        outgoing_count = 0

        if target_block_id:
            incoming_count = self._count_incoming(connections, target_block_id)
            outgoing_count = self._count_outgoing(connections, target_block_id)

        sorted_blocks = self._sort_blocks_by_position(blocks)
        target_index = self._get_block_index(sorted_blocks, target_block_id)
        previous_block = self._get_previous_block(sorted_blocks, target_index)

        previous_block_type = previous_block.get("type") if previous_block else "none"
        last_block_type = sorted_blocks[-1].get("type") if sorted_blocks else "none"

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
            "previous_block_type": previous_block_type,
            "last_block_type": last_block_type,

            "target_index": target_index,
            "is_target_last_block": int(target_index == len(sorted_blocks) - 1 and target_index >= 0),
            "is_empty_workflow": int(len(blocks) == 0),
            "linear_depth": self._calculate_linear_depth(blocks, connections),
            "condition_blocks_with_one_output": self._count_condition_blocks_with_outputs(
                blocks=blocks,
                connections=connections,
                expected_outputs_count=1,
            ),
            "condition_blocks_with_two_or_more_outputs": self._count_condition_blocks_with_min_outputs(
                blocks=blocks,
                connections=connections,
                min_outputs_count=2,
            ),
        }

        for block_type in BLOCK_TYPES:
            features[f"{block_type}_blocks_count"] = block_type_counts[block_type]
            features[f"is_target_{block_type}"] = int(target_block_type == block_type)
            features[f"is_previous_{block_type}"] = int(previous_block_type == block_type)
            features[f"is_last_{block_type}"] = int(last_block_type == block_type)

        features["is_target_none"] = int(target_block_type == "none")
        features["is_previous_none"] = int(previous_block_type == "none")
        features["is_last_none"] = int(last_block_type == "none")

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
        sorted_blocks = self._sort_blocks_by_position(blocks)

        for block in sorted_blocks:
            block_id = block.get("id")
            block_type = block.get("type")

            if not block_id or block_type == "end":
                continue

            if self._count_outgoing(connections, block_id) == 0:
                return block

        return None

    def _sort_blocks_by_position(self, blocks: list[dict]) -> list[dict]:
        return sorted(
            blocks,
            key=lambda block: (
                block.get("position", {}).get("x", 0) or 0,
                block.get("position", {}).get("y", 0) or 0,
                block.get("id", ""),
            ),
        )

    def _get_rightmost_block(self, blocks: list[dict]) -> dict:
        return max(
            blocks,
            key=lambda block: (
                block.get("position", {}).get("x", 0) or 0,
                block.get("position", {}).get("y", 0) or 0,
            ),
        )

    def _get_block_index(self, sorted_blocks: list[dict], block_id: str | None) -> int:
        if not block_id:
            return -1

        for index, block in enumerate(sorted_blocks):
            if block.get("id") == block_id:
                return index

        return -1

    def _get_previous_block(self, sorted_blocks: list[dict], target_index: int) -> dict | None:
        if target_index <= 0:
            return None

        return sorted_blocks[target_index - 1]

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

    def _calculate_linear_depth(self, blocks: list[dict], connections: list[dict]) -> int:
        if not blocks:
            return 0

        start_blocks = [
            block
            for block in blocks
            if block.get("type") == "start"
        ]

        if not start_blocks:
            return len(blocks)

        adjacency: dict[str, list[str]] = {}

        for connection in connections:
            source_id = connection.get("sourceBlockId")
            target_id = connection.get("targetBlockId")

            if not source_id or not target_id:
                continue

            adjacency.setdefault(source_id, []).append(target_id)

        max_depth = 0
        stack = [
            (block.get("id"), 1)
            for block in start_blocks
            if block.get("id")
        ]
        visited = set()

        while stack:
            block_id, depth = stack.pop()
            max_depth = max(max_depth, depth)

            if block_id in visited:
                continue

            visited.add(block_id)

            for next_block_id in adjacency.get(block_id, []):
                stack.append((next_block_id, depth + 1))

        return max_depth

    def _count_condition_blocks_with_outputs(
        self,
        blocks: list[dict],
        connections: list[dict],
        expected_outputs_count: int,
    ) -> int:
        return sum(
            1
            for block in blocks
            if block.get("type") == "condition"
            and block.get("id")
            and self._count_outgoing(connections, block["id"]) == expected_outputs_count
        )

    def _count_condition_blocks_with_min_outputs(
        self,
        blocks: list[dict],
        connections: list[dict],
        min_outputs_count: int,
    ) -> int:
        return sum(
            1
            for block in blocks
            if block.get("type") == "condition"
            and block.get("id")
            and self._count_outgoing(connections, block["id"]) >= min_outputs_count
        )
