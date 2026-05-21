from pathlib import Path
from typing import Any

import joblib
import pandas as pd


BASE_DIR = Path(__file__).resolve().parents[1]

ARTIFACTS_DIR = BASE_DIR / "artifacts"

LABEL_ENCODER_PATH = ARTIFACTS_DIR / "label_encoder.joblib"

LEGACY_MODEL_PATH = ARTIFACTS_DIR / "block_classifier.joblib"

MODEL_PATHS = {
    "random_forest": ARTIFACTS_DIR / "random_forest.joblib",
    "extra_trees": ARTIFACTS_DIR / "extra_trees.joblib",
    "mlp": ARTIFACTS_DIR / "mlp.joblib",
    "text_tfidf_logreg": ARTIFACTS_DIR / "text_tfidf_logreg.joblib",
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


class RuleBasedBlockClassifier:
    """
    Резервный классификатор.

    Используется, если обученные модели ещё не созданы
    или не смогли загрузиться из artifacts/.
    """

    def predict(self, features: dict, workflow_text: str | None = None) -> tuple[str, int]:
        if features["is_empty_workflow"]:
            return "start", 96

        if not features["has_start"]:
            return "start", 95

        target_block_type = features["target_block_type"]

        if target_block_type == "start":
            return "ai", 82

        if target_block_type == "ai":
            return "log", 88

        if target_block_type == "http":
            return "condition", 84

        if target_block_type == "condition":
            return "merge", 76

        if target_block_type == "action":
            return "log", 78

        if target_block_type == "database":
            return "log", 76

        if target_block_type == "email":
            return "end", 72

        if target_block_type == "log":
            return "end", 82

        if target_block_type == "loop":
            return "log", 74

        if target_block_type == "merge":
            return "log", 75

        if not features["has_end"]:
            return "end", 70

        return "action", 60


class LegacyTrainedBlockClassifier:
    """
    Совместимость со старым форматом:
    artifacts/block_classifier.joblib + artifacts/label_encoder.joblib

    Сейчас block_classifier.joblib сохраняется как alias для random_forest.
    """

    def __init__(
        self,
        model_path: Path = LEGACY_MODEL_PATH,
        label_encoder_path: Path = LABEL_ENCODER_PATH,
    ):
        self.model = joblib.load(model_path)
        self.label_encoder = joblib.load(label_encoder_path)

    def predict(self, features: dict, workflow_text: str | None = None) -> tuple[str, int]:
        feature_frame = pd.DataFrame([features])

        encoded_prediction = self.model.predict(feature_frame)[0]
        block_type = self.label_encoder.inverse_transform([encoded_prediction])[0]

        confidence = self._calculate_confidence(
            feature_frame=feature_frame,
            encoded_prediction=encoded_prediction,
        )

        return str(block_type), confidence

    def _calculate_confidence(
        self,
        feature_frame: pd.DataFrame,
        encoded_prediction: int,
    ) -> int:
        if not hasattr(self.model, "predict_proba"):
            return 70

        probabilities = self.model.predict_proba(feature_frame)[0]
        model_classes = self._get_model_classes(self.model)

        if encoded_prediction not in model_classes:
            return 70

        class_index = model_classes.index(encoded_prediction)
        probability = probabilities[class_index]

        return self._to_confidence(probability)

    def _get_model_classes(self, model) -> list[int]:
        if hasattr(model, "classes_"):
            return list(model.classes_)

        classifier = getattr(model, "named_steps", {}).get("classifier")

        if classifier is not None and hasattr(classifier, "classes_"):
            return list(classifier.classes_)

        return []

    def _to_confidence(self, probability: float) -> int:
        return max(0, min(100, int(round(float(probability) * 100))))


class EnsembleBlockClassifier:
    """
    Ансамбль моделей рекомендаций.

    Использует soft voting:
    - каждая модель возвращает вероятности классов;
    - вероятности выравниваются по общему LabelEncoder;
    - вероятности суммируются с весами;
    - побеждает класс с максимальной суммарной оценкой.
    """

    def __init__(
        self,
        model_paths: dict[str, Path] = MODEL_PATHS,
        label_encoder_path: Path = LABEL_ENCODER_PATH,
    ):
        self.label_encoder = joblib.load(label_encoder_path)
        self.models = self._load_available_models(model_paths)

        if not self.models:
            raise FileNotFoundError("No ensemble model artifacts were loaded.")

    def predict(self, features: dict, workflow_text: str | None = None) -> tuple[str, int]:
        all_classes = list(range(len(self.label_encoder.classes_)))

        scores = [0.0 for _ in all_classes]
        total_weight = 0.0

        for model_name, model in self.models.items():
            probabilities = self._predict_model_proba(
                model_name=model_name,
                model=model,
                features=features,
                workflow_text=workflow_text,
            )

            if probabilities is None:
                continue

            model_classes = self._get_model_classes(model)

            if not model_classes:
                continue

            weight = MODEL_WEIGHTS.get(model_name, 1.0)

            for local_index, encoded_class in enumerate(model_classes):
                if encoded_class not in all_classes:
                    continue

                global_index = all_classes.index(encoded_class)
                scores[global_index] += float(probabilities[local_index]) * weight

            total_weight += weight

        if total_weight == 0:
            raise ValueError("No ensemble model with predict_proba was available.")

        normalized_scores = [
            score / total_weight
            for score in scores
        ]

        best_class_index = max(
            range(len(normalized_scores)),
            key=lambda index: normalized_scores[index],
        )

        encoded_prediction = all_classes[best_class_index]
        block_type = self.label_encoder.inverse_transform([encoded_prediction])[0]
        confidence = self._to_confidence(normalized_scores[best_class_index])

        return str(block_type), confidence

    def get_model_names(self) -> list[str]:
        return list(self.models.keys())

    def _load_available_models(self, model_paths: dict[str, Path]) -> dict[str, Any]:
        models = {}

        for model_name, model_path in model_paths.items():
            if not model_path.exists():
                continue

            try:
                models[model_name] = joblib.load(model_path)
            except Exception:
                continue

        return models

    def _predict_model_proba(
        self,
        model_name: str,
        model,
        features: dict,
        workflow_text: str | None,
    ):
        if not hasattr(model, "predict_proba"):
            return None

        model_input = self._build_model_input(
            model_name=model_name,
            features=features,
            workflow_text=workflow_text,
        )

        probabilities = model.predict_proba(model_input)

        if len(probabilities) == 0:
            return None

        return probabilities[0]

    def _build_model_input(
        self,
        model_name: str,
        features: dict,
        workflow_text: str | None,
    ):
        if model_name in STRUCTURAL_MODEL_NAMES:
            return pd.DataFrame([features])

        if model_name in TEXT_MODEL_NAMES:
            return pd.Series([workflow_text or ""])

        raise ValueError(f"Unknown model type for model: {model_name}")

    def _get_model_classes(self, model) -> list[int]:
        if hasattr(model, "classes_"):
            return list(model.classes_)

        classifier = getattr(model, "named_steps", {}).get("classifier")

        if classifier is not None and hasattr(classifier, "classes_"):
            return list(classifier.classes_)

        return []

    def _to_confidence(self, probability: float) -> int:
        return max(0, min(100, int(round(float(probability) * 100))))


class BlockClassifier:
    """
    Основной классификатор MLService.

    Приоритет:
    1. ensemble из 4 моделей;
    2. legacy random_forest model;
    3. rule-based fallback.
    """

    def __init__(self):
        self.fallback_classifier = RuleBasedBlockClassifier()
        self.ensemble_classifier = self._load_ensemble_classifier()
        self.legacy_classifier = self._load_legacy_classifier()

    def predict(self, features: dict, workflow_text: str | None = None) -> tuple[str, int]:
        if self.ensemble_classifier:
            try:
                return self.ensemble_classifier.predict(
                    features=features,
                    workflow_text=workflow_text,
                )
            except Exception:
                pass

        if self.legacy_classifier:
            try:
                return self.legacy_classifier.predict(
                    features=features,
                    workflow_text=workflow_text,
                )
            except Exception:
                pass

        return self.fallback_classifier.predict(
            features=features,
            workflow_text=workflow_text,
        )

    def is_trained_model_available(self) -> bool:
        return self.ensemble_classifier is not None or self.legacy_classifier is not None

    def get_runtime_mode(self) -> str:
        if self.ensemble_classifier:
            return "ensemble"

        if self.legacy_classifier:
            return "legacy"

        return "rule-based"

    def get_model_names(self) -> list[str]:
        if self.ensemble_classifier:
            return self.ensemble_classifier.get_model_names()

        if self.legacy_classifier:
            return ["legacy_random_forest"]

        return ["rule_based"]

    def _load_ensemble_classifier(self) -> EnsembleBlockClassifier | None:
        if not LABEL_ENCODER_PATH.exists():
            return None

        try:
            return EnsembleBlockClassifier()
        except Exception:
            return None

    def _load_legacy_classifier(self) -> LegacyTrainedBlockClassifier | None:
        if not LABEL_ENCODER_PATH.exists():
            return None

        if not LEGACY_MODEL_PATH.exists():
            return None

        try:
            return LegacyTrainedBlockClassifier()
        except Exception:
            return None
