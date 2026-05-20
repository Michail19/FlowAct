from pathlib import Path

import joblib
import pandas as pd


BASE_DIR = Path(__file__).resolve().parents[1]

DEFAULT_MODEL_PATH = BASE_DIR / "artifacts" / "block_classifier.joblib"
DEFAULT_LABEL_ENCODER_PATH = BASE_DIR / "artifacts" / "label_encoder.joblib"


class RuleBasedBlockClassifier:
    """
    Резервный классификатор.

    Используется, если обученная модель ещё не создана
    или не смогла загрузиться из artifacts/.
    """

    def predict(self, features: dict) -> tuple[str, int]:
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


class TrainedBlockClassifier:
    """
    Классификатор на основе обученной модели scikit-learn.
    """

    def __init__(
        self,
        model_path: Path = DEFAULT_MODEL_PATH,
        label_encoder_path: Path = DEFAULT_LABEL_ENCODER_PATH,
    ):
        self.model_path = model_path
        self.label_encoder_path = label_encoder_path

        self.model = joblib.load(model_path)
        self.label_encoder = joblib.load(label_encoder_path)

    def predict(self, features: dict) -> tuple[str, int]:
        feature_frame = pd.DataFrame([features])

        encoded_prediction = self.model.predict(feature_frame)[0]
        block_type = self.label_encoder.inverse_transform([encoded_prediction])[0]

        confidence = self._calculate_confidence(feature_frame, encoded_prediction)

        return block_type, confidence

    def _calculate_confidence(self, feature_frame: pd.DataFrame, encoded_prediction: int) -> int:
        if not hasattr(self.model, "predict_proba"):
            return 70

        probabilities = self.model.predict_proba(feature_frame)[0]

        class_list = list(self.model.classes_)

        if encoded_prediction not in class_list:
            return 70

        class_index = class_list.index(encoded_prediction)
        probability = probabilities[class_index]

        return int(round(float(probability) * 100))


class BlockClassifier:
    """
    Основной классификатор MLService.

    Пытается использовать обученную модель.
    Если модель ещё не создана, использует rule-based fallback.
    """

    def __init__(self):
        self.fallback_classifier = RuleBasedBlockClassifier()
        self.trained_classifier = self._load_trained_classifier()

    def predict(self, features: dict) -> tuple[str, int]:
        if self.trained_classifier:
            try:
                return self.trained_classifier.predict(features)
            except Exception:
                return self.fallback_classifier.predict(features)

        return self.fallback_classifier.predict(features)

    def is_trained_model_available(self) -> bool:
        return self.trained_classifier is not None

    def _load_trained_classifier(self) -> TrainedBlockClassifier | None:
        if not DEFAULT_MODEL_PATH.exists():
            return None

        if not DEFAULT_LABEL_ENCODER_PATH.exists():
            return None

        try:
            return TrainedBlockClassifier()
        except Exception:
            return None
