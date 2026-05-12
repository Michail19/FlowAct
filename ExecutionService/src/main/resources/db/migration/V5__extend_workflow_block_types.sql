ALTER TABLE workflow_blocks
DROP CONSTRAINT IF EXISTS chk_workflow_blocks_type;

ALTER TABLE workflow_blocks
    ADD CONSTRAINT chk_workflow_blocks_type
        CHECK (
            type IN (
                     'START',
                     'END',
                     'INPUT',
                     'IF',
                     'SWITCH',
                     'MERGE',
                     'SET_VARIABLE',
                     'MAP',
                     'FILTER',
                     'TRANSFORM_JSON',
                     'HTTP_REQUEST',
                     'LLM_REQUEST',
                     'ML_REQUEST',
                     'DATABASE_QUERY',
                     'EMAIL_SEND',
                     'LOG_MESSAGE',
                     'DELAY',
                     'WAIT',
                     'WEBHOOK'
                )
            );
