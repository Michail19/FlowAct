import argparse
import csv
import json
import random
import sys
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from recommendations.feature_extractor import WorkflowFeatureExtractor  # noqa: E402


DEFAULT_INPUT_PATH = BASE_DIR / "training" / "data" / "training_workflows.json"
DEFAULT_OUTPUT_PATH = BASE_DIR / "training" / "data" / "training_dataset.csv"

TARGET_COLUMN = "recommended_block_type"
CASE_ID_COLUMN = "case_id"


BLOCK_TITLES = {
    "start": "Старт",
    "end": "Конец",
    "ai": "AI-функция",
    "condition": "Условие",
    "action": "Действие",
    "database": "База данных",
    "email": "Email",
    "log": "Логирование",
    "http": "HTTP-запрос",
    "loop": "Цикл",
    "merge": "Объединение",
}


LINEAR_WORKFLOW_TEMPLATES = [
    {
        "templateId": "ai_processing",
        "sequence": ["start", "ai", "log", "end"],
    },
    {
        "templateId": "http_check_log",
        "sequence": ["start", "http", "condition", "log", "end"],
    },
    {
        "templateId": "http_check_email",
        "sequence": ["start", "http", "condition", "email", "end"],
    },
    {
        "templateId": "http_collection_loop",
        "sequence": ["start", "http", "loop", "log", "end"],
    },
    {
        "templateId": "database_read_log",
        "sequence": ["start", "database", "log", "end"],
    },
    {
        "templateId": "database_check_email",
        "sequence": ["start", "database", "condition", "email", "end"],
    },
    {
        "templateId": "action_transform_log",
        "sequence": ["start", "action", "log", "end"],
    },
    {
        "templateId": "loop_transform_log",
        "sequence": ["start", "loop", "action", "log", "end"],
    },
    {
        "templateId": "email_notification",
        "sequence": ["start", "email", "end"],
    },
    {
        "templateId": "ai_decision_email",
        "sequence": ["start", "ai", "condition", "email", "end"],
    },
    {
        "templateId": "ai_decision_merge_log",
        "sequence": ["start", "ai", "condition", "merge", "log", "end"],
    },
    {
        "templateId": "http_action_database_log",
        "sequence": ["start", "http", "action", "database", "log", "end"],
    },
    {
        "templateId": "database_loop_log",
        "sequence": ["start", "database", "loop", "log", "end"],
    },
    {
        "templateId": "http_condition_action_log",
        "sequence": ["start", "http", "condition", "action", "log", "end"],
    },
]


def load_manual_cases(input_path: Path) -> list[dict]:
    if not input_path.exists():
        return []

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


def create_block(
    block_type: str,
    index: int,
    template_id: str,
    variation_index: int,
    rng: random.Random,
) -> dict:
    block_id = f"{template_id}-{variation_index}-{index}-{block_type}"

    return {
        "id": block_id,
        "type": block_type,
        "title": BLOCK_TITLES.get(block_type, block_type),
        "position": {
            "x": 100 + index * 250 + rng.randint(-35, 35),
            "y": 100 + rng.randint(-70, 70),
        },
        "config": {},
    }


def create_linear_workflow(
    sequence: list[str],
    template_id: str,
    variation_index: int,
    rng: random.Random,
) -> dict:
    blocks = [
        create_block(
            block_type=block_type,
            index=index,
            template_id=template_id,
            variation_index=variation_index,
            rng=rng,
        )
        for index, block_type in enumerate(sequence)
    ]

    connections = []

    for index in range(len(blocks) - 1):
        connections.append(
            {
                "id": f"{template_id}-{variation_index}-conn-{index}",
                "sourceBlockId": blocks[index]["id"],
                "targetBlockId": blocks[index + 1]["id"],
            }
        )

    return {
        "blocks": blocks,
        "connections": connections,
    }


def generate_linear_cases(synthetic_repeats: int, seed: int) -> list[dict]:
    rng = random.Random(seed)
    synthetic_cases = []

    for variation_index in range(synthetic_repeats):
        for template_index, template in enumerate(LINEAR_WORKFLOW_TEMPLATES):
            template_id = template["templateId"]
            sequence = template["sequence"]

            for next_block_index in range(len(sequence)):
                # Пустой workflow -> start.
                # Чтобы не создать слишком много одинаковых пустых примеров,
                # добавляем его только для первого шаблона каждой вариации.
                if next_block_index == 0 and template_index > 0:
                    continue

                prefix_sequence = sequence[:next_block_index]
                recommended_block_type = sequence[next_block_index]

                workflow = create_linear_workflow(
                    sequence=prefix_sequence,
                    template_id=template_id,
                    variation_index=variation_index,
                    rng=rng,
                )

                target_block_id = None

                if workflow["blocks"]:
                    target_block_id = workflow["blocks"][-1]["id"]

                synthetic_cases.append(
                    {
                        "caseId": (
                            f"synthetic_{template_id}_"
                            f"v{variation_index}_step{next_block_index}_"
                            f"recommend_{recommended_block_type}"
                        ),
                        "workflow": workflow,
                        "targetBlockId": target_block_id,
                        "recommendedBlockType": recommended_block_type,
                    }
                )

    return synthetic_cases


def generate_condition_branch_cases(synthetic_repeats: int, seed: int) -> list[dict]:
    rng = random.Random(seed + 10_000)
    cases = []

    branch_templates = [
        {
            "templateId": "condition_one_branch_recommend_email",
            "sequence": ["start", "http", "condition", "log"],
            "targetIndex": 2,
            "recommendedBlockType": "email",
        },
        {
            "templateId": "condition_one_branch_recommend_action",
            "sequence": ["start", "database", "condition", "email"],
            "targetIndex": 2,
            "recommendedBlockType": "action",
        },
        {
            "templateId": "condition_two_branches_recommend_merge",
            "sequence": ["start", "http", "condition", "email", "log"],
            "targetIndex": 2,
            "recommendedBlockType": "merge",
        },
        {
            "templateId": "condition_ai_branch_recommend_merge",
            "sequence": ["start", "ai", "condition", "email", "log"],
            "targetIndex": 2,
            "recommendedBlockType": "merge",
        },
    ]

    for variation_index in range(synthetic_repeats):
        for template in branch_templates:
            template_id = template["templateId"]
            sequence = template["sequence"]

            workflow = create_linear_workflow(
                sequence=sequence,
                template_id=template_id,
                variation_index=variation_index,
                rng=rng,
            )

            target_block = workflow["blocks"][template["targetIndex"]]

            # Для шаблонов с двумя ветками делаем вторую связь от condition вручную.
            if "two_branches" in template_id or "ai_branch" in template_id:
                condition_block = workflow["blocks"][template["targetIndex"]]
                extra_target_block = workflow["blocks"][-1]

                workflow["connections"].append(
                    {
                        "id": f"{template_id}-{variation_index}-extra-branch",
                        "sourceBlockId": condition_block["id"],
                        "targetBlockId": extra_target_block["id"],
                        "sourceHandle": "no",
                        "label": "Нет",
                    }
                )

            cases.append(
                {
                    "caseId": (
                        f"synthetic_{template_id}_"
                        f"v{variation_index}_recommend_{template['recommendedBlockType']}"
                    ),
                    "workflow": workflow,
                    "targetBlockId": target_block["id"],
                    "recommendedBlockType": template["recommendedBlockType"],
                }
            )

    return cases


def generate_synthetic_cases(synthetic_repeats: int, seed: int) -> list[dict]:
    if synthetic_repeats <= 0:
        return []

    return [
        *generate_linear_cases(
            synthetic_repeats=synthetic_repeats,
            seed=seed,
        ),
        *generate_condition_branch_cases(
            synthetic_repeats=synthetic_repeats,
            seed=seed,
        ),
    ]


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
            CASE_ID_COLUMN: case_id,
            **features,
            TARGET_COLUMN: recommended_block_type,
        }

        rows.append(row)

    return rows


def collect_fieldnames(rows: list[dict]) -> list[str]:
    fieldnames = [CASE_ID_COLUMN]

    for row in rows:
        for key in row.keys():
            if key not in fieldnames and key != TARGET_COLUMN:
                fieldnames.append(key)

    fieldnames.append(TARGET_COLUMN)

    return fieldnames


def write_dataset(rows: list[dict], output_path: Path) -> None:
    if not rows:
        raise ValueError("Cannot write empty dataset.")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = collect_fieldnames(rows)

    with output_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=fieldnames,
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
    parser.add_argument(
        "--synthetic-repeats",
        type=int,
        default=8,
        help="How many synthetic variations should be generated for each workflow template.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for synthetic dataset generation.",
    )
    parser.add_argument(
        "--manual-only",
        action="store_true",
        help="Generate dataset only from training_workflows.json without synthetic examples.",
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    manual_cases = load_manual_cases(args.input)

    synthetic_cases = []

    if not args.manual_only:
        synthetic_cases = generate_synthetic_cases(
            synthetic_repeats=args.synthetic_repeats,
            seed=args.seed,
        )

    cases = [
        *manual_cases,
        *synthetic_cases,
    ]

    rows = build_dataset_rows(cases)
    write_dataset(rows, args.output)

    target_counts = {}

    for row in rows:
        target = row[TARGET_COLUMN]
        target_counts[target] = target_counts.get(target, 0) + 1

    print(f"Loaded manual cases: {len(manual_cases)}")
    print(f"Generated synthetic cases: {len(synthetic_cases)}")
    print(f"Generated rows: {len(rows)}")
    print(f"Dataset saved to: {args.output}")
    print()
    print("Target distribution:")

    for target, count in sorted(target_counts.items()):
        print(f"  {target}: {count}")


if __name__ == "__main__":
    main()
