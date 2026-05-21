from recommendations.classifier import BlockClassifier
from recommendations.feature_extractor import WorkflowFeatureExtractor
from recommendations.response_builder import RecommendationResponseBuilder
from recommendations.text_extractor import WorkflowTextExtractor


class NextBlockRecommendationService:
    def __init__(self):
        self.feature_extractor = WorkflowFeatureExtractor()
        self.text_extractor = WorkflowTextExtractor()
        self.classifier = BlockClassifier()
        self.response_builder = RecommendationResponseBuilder()

    def recommend(self, workflow: dict, target_block_id: str | None, limit: int = 3) -> list[dict]:
        features = self.feature_extractor.extract(
            workflow=workflow,
            target_block_id=target_block_id,
        )

        workflow_text = self.text_extractor.extract(
            workflow=workflow,
            target_block_id=target_block_id,
        )

        block_type, confidence = self.classifier.predict(
            features=features,
            workflow_text=workflow_text,
        )

        recommendation = self.response_builder.build_next_block_recommendation(
            block_type=block_type,
            confidence=confidence,
            workflow=workflow,
            target_block_id=target_block_id,
        )

        return [recommendation][:limit]
