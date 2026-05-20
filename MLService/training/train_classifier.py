import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder


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


def split_features_and_target(dataset: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    feature_columns = [
        column
        for column in dataset.columns
        if column not in {TARGET_COLUMN, CASE_ID_COLUMN}
    ]

    features = dataset[feature_columns].copy()
    target = dataset[TARGET_COLUMN].copy()

    return features, target


def build_pipeline(features: pd.DataFrame) -> Pipeline:
    categorical_columns = [
        column
        for column in features.columns
        if features[column].dtype == "object"
    ]

    numeric_columns = [
        column
        for column in features.columns
        if column not in categorical_columns
    ]

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "categorical",
                OneHotEncoder(handle_unknown="ignore"),
                categorical_columns,
            ),
            (
                "numeric",
                "passthrough",
                numeric_columns,
            ),
        ],
    )

    classifier = RandomForestClassifier(
        n_estimators=200,
        max_depth=8,
        random_state=42,
        class_weight="balanced",
    )

    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", classifier),
        ],
    )


def can_use_train_test_split(target: pd.Series) -> bool:
    if len(target) < 10:
        return False

    class_counts = target.value_counts()

    if len(class_counts) < 2:
        return False

    return class_counts.min() >= 2


def train_model(
    features: pd.DataFrame,
    target: pd.Series,
) -> tuple[Pipeline, LabelEncoder, dict]:
    label_encoder = LabelEncoder()
    encoded_target = label_encoder.fit_transform(target)

    pipeline = build_pipeline(features)

    metrics = {
        "mode": "train_only",
        "accuracy": None,
        "classificationReport": None,
    }

    if can_use_train_test_split(target):
        stratify = target if target.value_counts().min() >= 2 else None

        x_train, x_test, y_train, y_test = train_test_split(
            features,
            encoded_target,
            test_size=0.25,
            random_state=42,
            stratify=stratify,
        )

        pipeline.fit(x_train, y_train)

        predictions = pipeline.predict(x_test)
        accuracy = accuracy_score(y_test, predictions)

        target_names = label_encoder.inverse_transform(
            sorted(set(y_test) | set(predictions)),
        )

        report = classification_report(
            y_test,
            predictions,
            labels=sorted(set(y_test) | set(predictions)),
            target_names=target_names,
            zero_division=0,
            output_dict=True,
        )

        metrics = {
            "mode": "train_test_split",
            "accuracy": accuracy,
            "classificationReport": report,
        }

        pipeline.fit(features, encoded_target)

        return pipeline, label_encoder, metrics

    pipeline.fit(features, encoded_target)

    predictions = pipeline.predict(features)
    accuracy = accuracy_score(encoded_target, predictions)

    target_names = label_encoder.inverse_transform(
        sorted(set(encoded_target) | set(predictions)),
    )

    report = classification_report(
        encoded_target,
        predictions,
        labels=sorted(set(encoded_target) | set(predictions)),
        target_names=target_names,
        zero_division=0,
        output_dict=True,
    )

    metrics = {
        "mode": "train_only_small_dataset",
        "accuracy": accuracy,
        "classificationReport": report,
    }

    return pipeline, label_encoder, metrics


def save_artifacts(
    pipeline: Pipeline,
    label_encoder: LabelEncoder,
    metrics: dict,
    dataset: pd.DataFrame,
    features: pd.DataFrame,
    artifacts_dir: Path,
) -> None:
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    model_path = artifacts_dir / MODEL_FILE_NAME
    label_encoder_path = artifacts_dir / LABEL_ENCODER_FILE_NAME
    meta_path = artifacts_dir / MODEL_META_FILE_NAME

    joblib.dump(pipeline, model_path)
    joblib.dump(label_encoder, label_encoder_path)

    meta = {
        "model": "RandomForestClassifier",
        "version": "1.0.0",
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "datasetRows": int(len(dataset)),
        "featureColumns": list(features.columns),
        "targetColumn": TARGET_COLUMN,
        "classes": list(label_encoder.classes_),
        "metrics": metrics,
        "artifacts": {
            "model": str(model_path.relative_to(BASE_DIR)),
            "labelEncoder": str(label_encoder_path.relative_to(BASE_DIR)),
        },
    }

    with meta_path.open("w", encoding="utf-8") as file:
        json.dump(meta, file, ensure_ascii=False, indent=2)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train FlowAct next-block recommendation classifier.",
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
        help="Directory where model artifacts will be saved.",
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    dataset = load_dataset(args.dataset)
    features, target = split_features_and_target(dataset)

    pipeline, label_encoder, metrics = train_model(features, target)

    save_artifacts(
        pipeline=pipeline,
        label_encoder=label_encoder,
        metrics=metrics,
        dataset=dataset,
        features=features,
        artifacts_dir=args.artifacts_dir,
    )

    print("Training completed.")
    print(f"Dataset rows: {len(dataset)}")
    print(f"Classes: {', '.join(label_encoder.classes_)}")
    print(f"Mode: {metrics['mode']}")
    print(f"Accuracy: {metrics['accuracy']}")
    print(f"Model saved to: {args.artifacts_dir / MODEL_FILE_NAME}")
    print(f"Label encoder saved to: {args.artifacts_dir / LABEL_ENCODER_FILE_NAME}")
    print(f"Metadata saved to: {args.artifacts_dir / MODEL_META_FILE_NAME}")


if __name__ == "__main__":
    main()
