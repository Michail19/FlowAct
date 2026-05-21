import argparse
import json
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)


BASE_DIR = Path(__file__).resolve().parents[1]

DEFAULT_DATASET_PATH = BASE_DIR / "training" / "data" / "training_dataset.csv"
DEFAULT_ARTIFACTS_DIR = BASE_DIR / "artifacts"

TARGET_COLUMN = "recommended_block_type"
CASE_ID_COLUMN = "case_id"
WORKFLOW_TEXT_COLUMN = "workflow_text"

LABEL_ENCODER_FILE_NAME = "label_encoder.joblib"
MODEL_META_FILE_NAME = "model_meta.json"

MODEL_FILE_NAMES = {
    "random_forest": "random_forest.joblib",
    "extra_trees": "extra_trees.joblib",
    "mlp": "mlp.joblib",
    "text_tfidf_logreg": "text_tfidf_logreg.joblib",
}

STRUCTURAL_MODEL_NAMES = {
    "random_forest",
    "extra_trees",
    "mlp",
}

TEXT_MODEL_NAMES = {
    "text_tfidf_logreg",
}

MODEL_WEIGHTS = {
    "random_forest": 1.0,
    "extra_trees": 1.0,
    "mlp": 0.8,
    "text_tfidf_logreg": 0.7,
}


def load_dataset(dataset_path: Path) -> pd.DataFrame:
    if not dataset_path.exists():
        raise FileNotFoundError(
            f"Dataset file not found: {dataset_path}. "
            "Run: python training/generate_dataset.py"
        )

    dataset = pd.read_csv(dataset_path)

    if dataset.empty:
        raise ValueError("Dataset is empty.")

    if TARGET_COLUMN not in dataset.columns:
        raise ValueError(f"Dataset must contain target column '{TARGET_COLUMN}'.")

    if WORKFLOW_TEXT_COLUMN not in dataset.columns:
        raise ValueError(
            f"Dataset must contain text column '{WORKFLOW_TEXT_COLUMN}'. "
            "Run: python training/generate_dataset.py"
        )

    return dataset


def get_structural_features(dataset: pd.DataFrame) -> pd.DataFrame:
    ignored_columns = {
        TARGET_COLUMN,
        CASE_ID_COLUMN,
        WORKFLOW_TEXT_COLUMN,
    }

    feature_columns = [
        column
        for column in dataset.columns
        if column not in ignored_columns
    ]

    return dataset[feature_columns].copy()


def get_text_features(dataset: pd.DataFrame) -> pd.Series:
    return dataset[WORKFLOW_TEXT_COLUMN].fillna("").astype(str)


def load_label_encoder(artifacts_dir: Path):
    label_encoder_path = artifacts_dir / LABEL_ENCODER_FILE_NAME

    if not label_encoder_path.exists():
        raise FileNotFoundError(
            f"Label encoder file not found: {label_encoder_path}. "
            "Run: python training/train_classifier.py --model all"
        )

    return joblib.load(label_encoder_path)


def load_model_metadata(artifacts_dir: Path) -> dict[str, Any]:
    meta_path = artifacts_dir / MODEL_META_FILE_NAME

    if not meta_path.exists():
        return {}

    with meta_path.open("r", encoding="utf-8") as file:
        return json.load(file)


def load_available_models(artifacts_dir: Path) -> dict[str, Any]:
    models = {}

    for model_name, file_name in MODEL_FILE_NAMES.items():
        model_path = artifacts_dir / file_name

        if not model_path.exists():
            continue

        models[model_name] = joblib.load(model_path)

    if not models:
        raise FileNotFoundError(
            f"No model artifacts found in {artifacts_dir}. "
            "Run: python training/train_classifier.py --model all"
        )

    return models


def get_model_input(
    model_name: str,
    structural_features: pd.DataFrame,
    text_features: pd.Series,
) -> pd.DataFrame | pd.Series:
    if model_name in STRUCTURAL_MODEL_NAMES:
        return structural_features

    if model_name in TEXT_MODEL_NAMES:
        return text_features

    raise ValueError(f"Unknown model name: {model_name}")


def predict_model(
    model_name: str,
    model,
    structural_features: pd.DataFrame,
    text_features: pd.Series,
):
    model_input = get_model_input(
        model_name=model_name,
        structural_features=structural_features,
        text_features=text_features,
    )

    return model.predict(model_input)


def predict_model_proba(
    model_name: str,
    model,
    structural_features: pd.DataFrame,
    text_features: pd.Series,
):
    if not hasattr(model, "predict_proba"):
        return None

    model_input = get_model_input(
        model_name=model_name,
        structural_features=structural_features,
        text_features=text_features,
    )

    return model.predict_proba(model_input)


def calculate_metrics(y_true, y_pred) -> dict[str, float]:
    return {
        "accuracy": accuracy_score(y_true, y_pred),
        "macroF1": f1_score(y_true, y_pred, average="macro", zero_division=0),
        "weightedF1": f1_score(y_true, y_pred, average="weighted", zero_division=0),
    }


def align_model_probabilities(
    probabilities,
    model_classes,
    all_classes,
) -> list[list[float]]:
    class_to_global_index = {
        encoded_class: index
        for index, encoded_class in enumerate(all_classes)
    }

    aligned_probabilities = []

    for row in probabilities:
        aligned_row = [0.0 for _ in all_classes]

        for local_index, encoded_class in enumerate(model_classes):
            global_index = class_to_global_index.get(encoded_class)

            if global_index is None:
                continue

            aligned_row[global_index] = float(row[local_index])

        aligned_probabilities.append(aligned_row)

    return aligned_probabilities


def predict_ensemble(
    models: dict[str, Any],
    structural_features: pd.DataFrame,
    text_features: pd.Series,
    all_classes,
) -> list[int]:
    ensemble_scores: list[list[float]] | None = None
    total_weight = 0.0

    for model_name, model in models.items():
        probabilities = predict_model_proba(
            model_name=model_name,
            model=model,
            structural_features=structural_features,
            text_features=text_features,
        )

        if probabilities is None:
            continue

        model_classes = list(model.classes_)
        aligned_probabilities = align_model_probabilities(
            probabilities=probabilities,
            model_classes=model_classes,
            all_classes=all_classes,
        )

        weight = MODEL_WEIGHTS.get(model_name, 1.0)

        if ensemble_scores is None:
            ensemble_scores = [
                [0.0 for _ in all_classes]
                for _ in range(len(aligned_probabilities))
            ]

        for row_index, probability_row in enumerate(aligned_probabilities):
            for class_index, probability in enumerate(probability_row):
                ensemble_scores[row_index][class_index] += probability * weight

        total_weight += weight

    if ensemble_scores is None or total_weight == 0:
        raise ValueError("Cannot build ensemble: no models with predict_proba available.")

    predictions = []

    for score_row in ensemble_scores:
        normalized_scores = [
            score / total_weight
            for score in score_row
        ]

        best_class_index = max(
            range(len(normalized_scores)),
            key=lambda index: normalized_scores[index],
        )

        predictions.append(all_classes[best_class_index])

    return predictions


def print_model_metadata(meta: dict[str, Any]) -> None:
    if not meta:
        print("Model metadata: not found")
        print()
        return

    print("Model metadata:")
    print(f"  Version: {meta.get('version')}")
    print(f"  Trained at: {meta.get('trainedAt')}")
    print(f"  Dataset rows: {meta.get('datasetRows')}")

    models_meta = meta.get("models", {})

    if models_meta:
        print("  Models:")

        for model_name, model_meta in models_meta.items():
            print(
                f"    {model_name}: "
                f"type={model_meta.get('type')}, "
                f"artifact={model_meta.get('artifact')}"
            )

    print()


def print_comparison_table(metrics_by_model: dict[str, dict[str, float]]) -> None:
    print("Model comparison:")
    print("-" * 72)
    print(f"{'Model':<24} {'Accuracy':>12} {'Macro F1':>12} {'Weighted F1':>14}")
    print("-" * 72)

    for model_name, metrics in metrics_by_model.items():
        print(
            f"{model_name:<24} "
            f"{metrics['accuracy']:>12.4f} "
            f"{metrics['macroF1']:>12.4f} "
            f"{metrics['weightedF1']:>14.4f}"
        )

    print("-" * 72)
    print()


def print_predictions_by_case(
    dataset: pd.DataFrame,
    y_true_labels: list[str],
    y_pred_labels: list[str],
    title: str,
) -> None:
    print(title)

    for index, row in dataset.iterrows():
        case_id = row.get(CASE_ID_COLUMN, f"case_{index}")
        actual = y_true_labels[index]
        predicted = y_pred_labels[index]

        marker = "OK" if actual == predicted else "MISS"

        print(
            f"  [{marker}] {case_id}: "
            f"actual={actual}, predicted={predicted}"
        )

    print()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate FlowAct next-block recommendation classifiers.",
    )
    parser.add_argument(
        "--dataset",
        type=Path,
        default=DEFAULT_DATASET_PATH,
        help="Path to generated training_dataset.csv.",
    )
    parser.add_argument(
        "--artifacts-dir",
        type=Path,
        default=DEFAULT_ARTIFACTS_DIR,
        help="Directory with model artifacts.",
    )
    parser.add_argument(
        "--show-cases",
        action="store_true",
        help="Show predictions for every case.",
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    dataset = load_dataset(args.dataset)
    structural_features = get_structural_features(dataset)
    text_features = get_text_features(dataset)

    label_encoder = load_label_encoder(args.artifacts_dir)
    meta = load_model_metadata(args.artifacts_dir)
    models = load_available_models(args.artifacts_dir)

    y_true_labels = dataset[TARGET_COLUMN].astype(str).tolist()
    y_true_encoded = label_encoder.transform(y_true_labels)

    all_encoded_classes = list(range(len(label_encoder.classes_)))

    print("Evaluation started.")
    print(f"Dataset rows: {len(dataset)}")
    print(f"Classes: {', '.join(label_encoder.classes_)}")
    print(f"Loaded models: {', '.join(models.keys())}")
    print()

    print_model_metadata(meta)

    metrics_by_model: dict[str, dict[str, float]] = {}
    predictions_by_model: dict[str, list[int]] = {}

    for model_name, model in models.items():
        predictions = predict_model(
            model_name=model_name,
            model=model,
            structural_features=structural_features,
            text_features=text_features,
        )

        predictions_by_model[model_name] = list(predictions)

        metrics_by_model[model_name] = calculate_metrics(
            y_true=y_true_encoded,
            y_pred=predictions,
        )

    ensemble_predictions = predict_ensemble(
        models=models,
        structural_features=structural_features,
        text_features=text_features,
        all_classes=all_encoded_classes,
    )

    predictions_by_model["ensemble_soft_voting"] = ensemble_predictions

    metrics_by_model["ensemble_soft_voting"] = calculate_metrics(
        y_true=y_true_encoded,
        y_pred=ensemble_predictions,
    )

    print_comparison_table(metrics_by_model)

    ensemble_labels = label_encoder.inverse_transform(ensemble_predictions)

    print("Ensemble classification report:")
    print(
        classification_report(
            y_true_labels,
            ensemble_labels,
            zero_division=0,
        )
    )

    labels = list(label_encoder.classes_)

    print("Ensemble confusion matrix:")
    print("Labels:", labels)
    print(confusion_matrix(y_true_labels, ensemble_labels, labels=labels))
    print()

    if args.show_cases:
        print_predictions_by_case(
            dataset=dataset,
            y_true_labels=y_true_labels,
            y_pred_labels=list(ensemble_labels),
            title="Ensemble predictions by case:",
        )


if __name__ == "__main__":
    main()
