import argparse
import csv
import json
import sys
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from recommendations.feature_extractor import WorkflowFeatureExtractor  # noqa: E402


DEFAULT_INPUT_PATH = BASE_DIR / "training" / "data" / "training_workflows.json"
DEFAULT_OUTPUT_PATH = BASE_DIR / "training" / "data" / "training_dataset.csv"


FEATURE_COLUMNS = [
    "case_id",
    "blocks_count",
    "connections_count",
    "has_start",
    "has_end",
    "target_has_incoming",
    "target_has_outgoing",
    "incoming_count",
    "outgoing_count",
    "dangling_input_blocks_count",
    "dangling_output_blocks_count",
    "target_position_x",
    "target_position_y",
    "target_block_type",
    "start_blocks_count",
    "end_blocks_count",
    "ai_blocks_count",
    "condition_blocks_count",
    "action_blocks_count",
    "database_blocks_count",
    "email_blocks_count",
    "log_blocks_count",
    "http_blocks_count",
    "loop_blocks_count",
    "merge_blocks_count",
    "is_target_start",
    "is_target_end",
    "is_target_ai",
    "is_target_condition",
    "is_target_action",
    "is_target_database",
    "is_target_email",
    "is_target_log",
    "is_target_http",
    "is_target_loop",
    "is_target_merge",
    "is_empty_workflow",
    "recommended_block_type",
]


def load_cases(input_path: Path) -> list[dict]:
    if not input_path.exists():
        raise FileNotFoundError(f"Training source file not found: {input_path}")

    with input_path.open("r", encoding="utf-8") as file:
        payload = json.load(file)

    if isinstance(payload, list):
        cases = payload
    else:
        cases = payload.get("cases", [])

    if not isinstance(cases, list):
        raise ValueError("Field 'cases' must be a list.")

    return cases


def validate_case(case: dict, index: int) -> None:
    case_id = case.get("caseId") or f"case_{index}"

    if "workflow" not in case:
        raise ValueError(f"Case '{case_id}' does not contain 'workflow'.")

    workflow = case["workflow"]

    if not isinstance(workflow, dict):
        raise ValueError(f"Case '{case_id}' field 'workflow' must be an object.")

    if "blocks" not in workflow:
        raise ValueError(f"Case '{case_id}' workflow does not contain 'blocks'.")

    if "connections" not in workflow:
        raise ValueError(f"Case '{case_id}' workflow does not contain 'connections'.")

    if "recommendedBlockType" not in case:
        raise ValueError(f"Case '{case_id}' does not contain 'recommendedBlockType'.")


def build_dataset_rows(cases: list[dict]) -> list[dict]:
    feature_extractor = WorkflowFeatureExtractor()
    rows = []

    for index, case in enumerate(cases, start=1):
        validate_case(case, index)

        case_id = case.get("caseId") or f"case_{index}"
        workflow = case["workflow"]
        target_block_id = case.get("targetBlockId")
        recommended_block_type = case["recommendedBlockType"]

        features = feature_extractor.extract(
            workflow=workflow,
            target_block_id=target_block_id,
        )

        row = {
            "case_id": case_id,
            **features,
            "recommended_block_type": recommended_block_type,
        }

        rows.append(row)

    return rows


def write_dataset(rows: list[dict], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=FEATURE_COLUMNS,
            extrasaction="ignore",
        )
        writer.writeheader()
        writer.writerows(rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate FlowAct ML training dataset from workflow examples.",
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT_PATH,
        help="Path to training_workflows.json.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help="Path to output training_dataset.csv.",
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    cases = load_cases(args.input)
    rows = build_dataset_rows(cases)
    write_dataset(rows, args.output)

    print(f"Loaded cases: {len(cases)}")
    print(f"Generated rows: {len(rows)}")
    print(f"Dataset saved to: {args.output}")


if __name__ == "__main__":
    main()
