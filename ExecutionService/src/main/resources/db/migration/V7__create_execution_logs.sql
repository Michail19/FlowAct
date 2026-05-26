CREATE TABLE IF NOT EXISTS execution_logs (
                                              id UUID PRIMARY KEY,
                                              execution_id UUID NOT NULL,
                                              block_id UUID NOT NULL,
                                              status VARCHAR(30) NOT NULL,
    input JSONB,
    output JSONB,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,

                             CONSTRAINT fk_execution_logs_execution
                             FOREIGN KEY (execution_id)
    REFERENCES executions (id)
                         ON DELETE CASCADE,

    CONSTRAINT fk_execution_logs_block
    FOREIGN KEY (block_id)
    REFERENCES workflow_blocks (id)
                         ON DELETE CASCADE
    );

CREATE INDEX IF NOT EXISTS idx_execution_logs_execution_id
    ON execution_logs (execution_id);

CREATE INDEX IF NOT EXISTS idx_execution_logs_block_id
    ON execution_logs (block_id);

CREATE INDEX IF NOT EXISTS idx_execution_logs_created_at
    ON execution_logs (created_at);
