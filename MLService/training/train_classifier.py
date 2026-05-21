import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import ExtraTreesClassifier, RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder, StandardScaler


BASE_DIR = Path(__file__).resolve().parents[1]

DEFAULT_DATASET_PATH = BASE_DIR / "training" / "data" / "training_dataset.csv"
DEFAULT_ARTIFACTS_DIR = BASE_DIR / "artifacts"

TARGET_COLUMN = "recommended_block_type"
CASE_ID_COLUMN = "case_id"
WORKFLOW_TEXT_COLUMN = "workflow_text"

LABEL_ENCODER_FILE_NAME = "label_encoder.joblib"
MODEL_META_FILE_NAME = "model_meta.json"

# Legacy artifact for compatibility with the current runtime classifier.
LEGACY_MODEL_FILE_NAME = "block_classifier.joblib"

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

ALL_MODEL_NAMES = [
    "random_forest",
    "extra_trees",
    "mlp",
    "text_tfidf_logreg",
]


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
            "Run updated: python training/generate_dataset.py"
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


def build_structural_preprocessor(features: pd.DataFrame) -> ColumnTransformer:
    categorical_columns = [
        column
        for column in features.columns
        if (
            pd.api.types.is_object_dtype(features[column])
            or pd.api.types.is_string_dtype(features[column])
            or isinstance(features[column].dtype, pd.CategoricalDtype)
        )
    ]

    numeric_columns = [
        column
        for column in features.columns
        if column not in categorical_columns
    ]

    return ColumnTransformer(
        transformers=[
            (
                "categorical",
                OneHotEncoder(handle_unknown="ignore"),
                categorical_columns,
            ),
            (
                "numeric",
                StandardScaler(),
                numeric_columns,
            ),
        ],
        sparse_threshold=0.0,
    )


def build_random_forest_pipeline(features: pd.DataFrame) -> Pipeline:
    return Pipeline(
        steps=[
            ("preprocessor", build_structural_preprocessor(features)),
            (
                "classifier",
                RandomForestClassifier(
                    n_estimators=250,
                    max_depth=10,
                    random_state=42,
                    class_weight="balanced",
                ),
            ),
        ],
    )


def build_extra_trees_pipeline(features: pd.DataFrame) -> Pipeline:
    return Pipeline(
        steps=[
            ("preprocessor", build_structural_preprocessor(features)),
            (
                "classifier",
                ExtraTreesClassifier(
                    n_estimators=300,
                    max_depth=12,
                    random_state=42,
                    class_weight="balanced",
                ),
            ),
        ],
    )


def build_mlp_pipeline(features: pd.DataFrame) -> Pipeline:
    return Pipeline(
        steps=[
            ("preprocessor", build_structural_preprocessor(features)),
            (
                "classifier",
                MLPClassifier(
                    hidden_layer_sizes=(96, 48),
                    activation="relu",
                    solver="adam",
                    alpha=0.0005,
                    learning_rate_init=0.001,
                    max_iter=800,
                    random_state=42,
                    early_stopping=True,
                    n_iter_no_change=30,
                ),
            ),
        ],
    )


def build_text_tfidf_logreg_pipeline() -> Pipeline:
    return Pipeline(
        steps=[
            (
                "tfidf",
                TfidfVectorizer(
                    max_features=5000,
                    ngram_range=(1, 2),
                    min_df=1,
                    sublinear_tf=True,
                ),
            ),
            (
                "classifier",
                LogisticRegression(
                    max_iter=2000,
                    class_weight="balanced",
                    random_state=42,
                ),
            ),
        ],
    )


def build_model_pipeline(model_name: str, structural_features: pd.DataFrame) -> Pipeline:
    if model_name == "random_forest":
        return build_random_forest_pipeline(structural_features)

    if model_name == "extra_trees":
        return build_extra_trees_pipeline(structural_features)

    if model_name == "mlp":
        return build_mlp_pipeline(structural_features)

    if model_name == "text_tfidf_logreg":
        return build_text_tfidf_logreg_pipeline()

    raise ValueError(f"Unknown model name: {model_name}")


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


def get_model_type(model_name: str) -> str:
    if model_name in STRUCTURAL_MODEL_NAMES:
        return "structural"

    if model_name in TEXT_MODEL_NAMES:
        return "text"

    return "unknown"


def get_model_feature_description(
    model_name: str,
    structural_features: pd.DataFrame,
) -> list[str]:
    if model_name in STRUCTURAL_MODEL_NAMES:
        return list(structural_features.columns)

    if model_name in TEXT_MODEL_NAMES:
        return [WORKFLOW_TEXT_COLUMN]

    return []


def can_use_train_test_split(target: pd.Series) -> bool:
    if len(target) < 10:
        return False

    class_counts = target.value_counts()

    if len(class_counts) < 2:
        return False

    return class_counts.min() >= 2


def train_and_evaluate_model(
    model_name: str,
    model: Pipeline,
    model_input: pd.DataFrame | pd.Series,
    encoded_target,
    original_target: pd.Series,
    label_encoder: LabelEncoder,
    test_size: float,
) -> tuple[Pipeline, dict[str, Any]]:
    if can_use_train_test_split(original_target):
        x_train, x_test, y_train, y_test = train_test_split(
            model_input,
            encoded_target,
            test_size=test_size,
            random_state=42,
            stratify=original_target,
        )

        model.fit(x_train, y_train)

        predictions = model.predict(x_test)

        metrics = build_metrics(
            mode="train_test_split",
            y_true=y_test,
            y_pred=predictions,
            label_encoder=label_encoder,
        )

        # Fit final model on the full dataset after measuring split quality.
        model.fit(model_input, encoded_target)

        return model, metrics

    model.fit(model_input, encoded_target)

    predictions = model.predict(model_input)

    metrics = build_metrics(
        mode="train_only_small_dataset",
        y_true=encoded_target,
        y_pred=predictions,
        label_encoder=label_encoder,
    )

    return model, metrics


def build_metrics(
    mode: str,
    y_true,
    y_pred,
    label_encoder: LabelEncoder,
) -> dict[str, Any]:
    used_labels = sorted(set(y_true) | set(y_pred))
    target_names = label_encoder.inverse_transform(used_labels)

    return {
        "mode": mode,
        "accuracy": accuracy_score(y_true, y_pred),
        "macroF1": f1_score(y_true, y_pred, average="macro", zero_division=0),
        "weightedF1": f1_score(y_true, y_pred, average="weighted", zero_division=0),
        "classificationReport": classification_report(
            y_true,
            y_pred,
            labels=used_labels,
            target_names=target_names,
            zero_division=0,
            output_dict=True,
        ),
    }


def select_models(model_argument: str) -> list[str]:
    if model_argument == "all":
        return ALL_MODEL_NAMES

    return [model_argument]


def to_json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            str(key): to_json_safe(nested_value)
            for key, nested_value in value.items()
        }

    if isinstance(value, list):
        return [to_json_safe(item) for item in value]

    if isinstance(value, tuple):
        return [to_json_safe(item) for item in value]

    if hasattr(value, "item"):
        return value.item()

    return value


def save_artifacts(
    trained_models: dict[str, Pipeline],
    label_encoder: LabelEncoder,
    metrics_by_model: dict[str, dict[str, Any]],
    dataset: pd.DataFrame,
    structural_features: pd.DataFrame,
    artifacts_dir: Path,
) -> None:
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    model_meta: dict[str, Any] = {
        "version": "2.0.0",
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "datasetRows": int(len(dataset)),
        "targetColumn": TARGET_COLUMN,
        "classes": list(label_encoder.classes_),
        "models": {},
    }

    label_encoder_path = artifacts_dir / LABEL_ENCODER_FILE_NAME
    joblib.dump(label_encoder, label_encoder_path)

    for model_name, model in trained_models.items():
        model_file_name = MODEL_FILE_NAMES[model_name]
        model_path = artifacts_dir / model_file_name

        joblib.dump(model, model_path)

        model_meta["models"][model_name] = {
            "type": get_model_type(model_name),
            "artifact": str(model_path.relative_to(BASE_DIR)),
            "featureColumns": get_model_feature_description(
                model_name=model_name,
                structural_features=structural_features,
            ),
            "metrics": metrics_by_model[model_name],
        }

    # Keep legacy artifact for current runtime classifier compatibility.
    if "random_forest" in trained_models:
        legacy_model_path = artifacts_dir / LEGACY_MODEL_FILE_NAME
        joblib.dump(trained_models["random_forest"], legacy_model_path)

        model_meta["legacyArtifact"] = str(legacy_model_path.relative_to(BASE_DIR))

    model_meta["labelEncoder"] = str(label_encoder_path.relative_to(BASE_DIR))

    meta_path = artifacts_dir / MODEL_META_FILE_NAME

    with meta_path.open("w", encoding="utf-8") as file:
        json.dump(
            to_json_safe(model_meta),
            file,
            ensure_ascii=False,
            indent=2,
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train FlowAct next-block recommendation classifiers.",
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
    parser.add_argument(
        "--model",
        choices=[
            "all",
            "random_forest",
            "extra_trees",
            "mlp",
            "text_tfidf_logreg",
        ],
        default="all",
        help="Which model should be trained.",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.25,
        help="Test split size for model evaluation.",
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    dataset = load_dataset(args.dataset)

    structural_features = get_structural_features(dataset)
    text_features = get_text_features(dataset)

    target = dataset[TARGET_COLUMN].copy()

    label_encoder = LabelEncoder()
    encoded_target = label_encoder.fit_transform(target)

    selected_models = select_models(args.model)

    trained_models: dict[str, Pipeline] = {}
    metrics_by_model: dict[str, dict[str, Any]] = {}

    print("Training started.")
    print(f"Dataset rows: {len(dataset)}")
    print(f"Classes: {', '.join(label_encoder.classes_)}")
    print(f"Selected models: {', '.join(selected_models)}")
    print()

    for model_name in selected_models:
        model_input = get_model_input(
            model_name=model_name,
            structural_features=structural_features,
            text_features=text_features,
        )

        model = build_model_pipeline(
            model_name=model_name,
            structural_features=structural_features,
        )

        trained_model, metrics = train_and_evaluate_model(
            model_name=model_name,
            model=model,
            model_input=model_input,
            encoded_target=encoded_target,
            original_target=target,
            label_encoder=label_encoder,
            test_size=args.test_size,
        )

        trained_models[model_name] = trained_model
        metrics_by_model[model_name] = metrics

        print(f"Model: {model_name}")
        print(f"  Type: {get_model_type(model_name)}")
        print(f"  Mode: {metrics['mode']}")
        print(f"  Accuracy: {metrics['accuracy']}")
        print(f"  Macro F1: {metrics['macroF1']}")
        print(f"  Weighted F1: {metrics['weightedF1']}")
        print()

    save_artifacts(
        trained_models=trained_models,
        label_encoder=label_encoder,
        metrics_by_model=metrics_by_model,
        dataset=dataset,
        structural_features=structural_features,
        artifacts_dir=args.artifacts_dir,
    )

    print("Training completed.")
    print(f"Artifacts saved to: {args.artifacts_dir}")

    for model_name in selected_models:
        print(f"  {model_name}: {args.artifacts_dir / MODEL_FILE_NAMES[model_name]}")

    print(f"  label_encoder: {args.artifacts_dir / LABEL_ENCODER_FILE_NAME}")
    print(f"  metadata: {args.artifacts_dir / MODEL_META_FILE_NAME}")

    if "random_forest" in selected_models:
        print(f"  legacy random_forest alias: {args.artifacts_dir / LEGACY_MODEL_FILE_NAME}")


if __name__ == "__main__":
    main()
