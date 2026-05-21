from rest_framework import serializers

from recommendations.block_types import ALLOWED_BLOCK_TYPES


class PositionSerializer(serializers.Serializer):
    x = serializers.FloatField(required=False, default=0)
    y = serializers.FloatField(required=False, default=0)


class WorkflowBlockSerializer(serializers.Serializer):
    id = serializers.CharField()
    type = serializers.ChoiceField(choices=sorted(ALLOWED_BLOCK_TYPES))
    title = serializers.CharField(required=False, allow_blank=True)
    subtitle = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    position = PositionSerializer(required=False)
    config = serializers.DictField(required=False, default=dict)


class WorkflowConnectionSerializer(serializers.Serializer):
    id = serializers.CharField(required=False, allow_blank=True)

    sourceBlockId = serializers.CharField(required=False, allow_blank=True)
    targetBlockId = serializers.CharField(required=False, allow_blank=True)

    fromBlockId = serializers.CharField(required=False, allow_blank=True)
    toBlockId = serializers.CharField(required=False, allow_blank=True)

    sourceHandle = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    targetHandle = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    label = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate(self, attrs):
        source_id = attrs.get("sourceBlockId") or attrs.get("fromBlockId")
        target_id = attrs.get("targetBlockId") or attrs.get("toBlockId")

        if not source_id or not target_id:
            raise serializers.ValidationError(
                "Connection must contain sourceBlockId/targetBlockId or fromBlockId/toBlockId."
            )

        attrs["sourceBlockId"] = source_id
        attrs["targetBlockId"] = target_id

        return attrs


class WorkflowSerializer(serializers.Serializer):
    blocks = WorkflowBlockSerializer(many=True, required=False, default=list)
    connections = WorkflowConnectionSerializer(many=True, required=False, default=list)


class NextBlockRecommendationRequestSerializer(serializers.Serializer):
    workflow = WorkflowSerializer()
    targetBlockId = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    limit = serializers.IntegerField(required=False, min_value=1, max_value=10, default=3)


class NotebookRecommendationSerializer(serializers.Serializer):
    id = serializers.CharField()
    kind = serializers.ChoiceField(choices=["next-block", "autocomplete", "workflow-fix"])
    source = serializers.ChoiceField(choices=["local-rules", "ai"])
    blockType = serializers.ChoiceField(choices=sorted(ALLOWED_BLOCK_TYPES))
    confidence = serializers.IntegerField(min_value=0, max_value=100)
    reason = serializers.CharField()
    targetBlockId = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    targetBlockTitle = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    proposedConfig = serializers.DictField(required=False)


class NextBlockRecommendationResponseSerializer(serializers.Serializer):
    recommendations = NotebookRecommendationSerializer(many=True)
