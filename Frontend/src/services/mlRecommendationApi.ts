import type { NotebookPayloadDto } from '../components/notebook/notebookBackendTypes';
import type { NotebookRecommendation } from '../components/notebook/recommendationTypes';

const DEFAULT_ML_SERVICE_BASE_URL = 'http://localhost:8000';
const NEXT_BLOCK_RECOMMENDATION_PATH = '/api/v1/recommendations/next-block/';

type MlRecommendationRequest = {
    workflow: {
        blocks: NotebookPayloadDto['blocks'];
        connections: NotebookPayloadDto['connections'];
    };
    targetBlockId?: string | null;
    limit?: number;
};

type MlRecommendationResponse = {
    recommendations: NotebookRecommendation[];
};

type GetNextBlockRecommendationsParams = {
    payload: NotebookPayloadDto;
    targetBlockId?: string | null;
    limit?: number;
    signal?: AbortSignal;
};

function getMlServiceBaseUrl() {
    return (
        import.meta.env.VITE_ML_SERVICE_BASE_URL ||
        DEFAULT_ML_SERVICE_BASE_URL
    ).replace(/\/$/, '');
}

function getFirstDanglingOutputBlockId(payload: NotebookPayloadDto): string | null {
    const sortedBlocks = [...payload.blocks].sort((firstBlock, secondBlock) => {
        if (firstBlock.position.x !== secondBlock.position.x) {
            return firstBlock.position.x - secondBlock.position.x;
        }

        if (firstBlock.position.y !== secondBlock.position.y) {
            return firstBlock.position.y - secondBlock.position.y;
        }

        return firstBlock.id.localeCompare(secondBlock.id);
    });

    const danglingBlock = sortedBlocks.find((block) => {
        if (block.type === 'end') {
            return false;
        }

        return !payload.connections.some(
            (connection) => connection.sourceBlockId === block.id,
        );
    });

    return danglingBlock?.id ?? null;
}

function buildRequestBody(params: GetNextBlockRecommendationsParams): MlRecommendationRequest {
    const targetBlockId =
        params.targetBlockId ??
        getFirstDanglingOutputBlockId(params.payload);

    return {
        workflow: {
            blocks: params.payload.blocks,
            connections: params.payload.connections,
        },
        targetBlockId,
        limit: params.limit ?? 3,
    };
}

async function requestNextBlockRecommendations(
    params: GetNextBlockRecommendationsParams,
): Promise<NotebookRecommendation[]> {
    const response = await fetch(
        `${getMlServiceBaseUrl()}${NEXT_BLOCK_RECOMMENDATION_PATH}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(buildRequestBody(params)),
            signal: params.signal,
        },
    );

    if (!response.ok) {
        throw new Error(`MLService request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as MlRecommendationResponse;

    return payload.recommendations ?? [];
}

export const mlRecommendationApi = {
    getNextBlockRecommendations: requestNextBlockRecommendations,
};
