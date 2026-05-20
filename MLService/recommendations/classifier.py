class RuleBasedBlockClassifier:
    """
    Временный классификатор.

    Позже этот класс заменим или расширим загрузкой обученной модели:
    artifacts/block_classifier.joblib.
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
