import argparse
import json
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix


BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))


DEFAULT_DATASET_PATH = BASE_DIR / "training" / "data" / "training_dataset.csv"
DEFAULT_ARTIFACTS_DIR = BASE_DIR / "artifacts"

TARGET_COLUMN = "recommended_block_type"
CASE_ID_COLUMN = "case_id"

MODEL_FILE_NAME = "block_classifier.joblib"
LABEL_ENCODER_FILE_NAME = "label_encoder.joblib"
MODEL_META_FILE_NAME = "model_meta.json"


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

    return dataset


def load_artifacts(artifacts_dir: Path):
    model_path = artifacts_dir / MODEL_FILE_NAME
    label_encoder_path = artifacts_dir / LABEL_ENCODER_FILE_NAME
    meta_path = artifacts_dir / MODEL_META_FILE_NAME

    if not model_path.exists():
        raise FileNotFoundError(
            f"Model file not found: {model_path}. "
            "Run: python training/train_classifier.py"
        )

    if not label_encoder_path.exists():
        raise FileNotFoundError(
            f"Label encoder file not found: {label_encoder_path}. "
            "Run: python training/train_classifier.py"
        )

    model = joblib.load(model_path)
    label_encoder = joblib.load(label_encoder_path)

    meta = {}

    if meta_path.exists():
        with meta_path.open("r", encoding="utf-8") as file:
            meta = json.load(file)

    return model, label_encoder, meta


def split_features_and_target(dataset: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    feature_columns = [
        column
        for column in dataset.columns
        if column not in {TARGET_COLUMN, CASE_ID_COLUMN}
    ]

    features = dataset[feature_columns].copy()
    target = dataset[TARGET_COLUMN].copy()

    return features, target


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate FlowAct next-block recommendation classifier.",
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

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    dataset = load_dataset(args.dataset)
    model, label_encoder, meta = load_artifacts(args.artifacts_dir)

    features, target = split_features_and_target(dataset)

    encoded_target = label_encoder.transform(target)

    encoded_predictions = model.predict(features)
    predictions = label_encoder.inverse_transform(encoded_predictions)

    accuracy = accuracy_score(target, predictions)

    print("Evaluation completed.")
    print(f"Dataset rows: {len(dataset)}")
    print(f"Accuracy: {accuracy}")
    print()

    if meta:
        print("Model metadata:")
        print(f"  Model: {meta.get('model')}")
        print(f"  Version: {meta.get('version')}")
        print(f"  Trained at: {meta.get('trainedAt')}")
        print()

    print("Classification report:")
    print(
        classification_report(
            target,
            predictions,
            zero_division=0,
        )
    )

    labels = list(label_encoder.classes_)

    print("Confusion matrix:")
    print("Labels:", labels)
    print(confusion_matrix(target, predictions, labels=labels))

    print()
    print("Predictions by case:")

    for _, row in dataset.iterrows():
        case_id = row.get(CASE_ID_COLUMN, "unknown")
        actual = row[TARGET_COLUMN]

        row_features = row.drop(labels=[TARGET_COLUMN, CASE_ID_COLUMN]).to_frame().T
        predicted_encoded = model.predict(row_features)[0]
        predicted = label_encoder.inverse_transform([predicted_encoded])[0]

        print(f"  {case_id}: actual={actual}, predicted={predicted}")


if __name__ == "__main__":
    main()
