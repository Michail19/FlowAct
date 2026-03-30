CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- NOTEBOOKS
-- =========================================================
CREATE TABLE notebooks (
                           id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                           owner_user_id UUID NOT NULL,
                           name VARCHAR(255) NOT NULL,
                           description TEXT,
                           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                           updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notebooks_owner_user_id
    ON notebooks (owner_user_id);

CREATE INDEX idx_notebooks_created_at
    ON notebooks (created_at DESC);

-- =========================================================
-- WORKFLOWS
-- =========================================================
CREATE TABLE workflows (
                           id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                           notebook_id UUID NOT NULL,
                           name VARCHAR(255) NOT NULL,
                           description TEXT,
                           status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
                           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                           updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                           CONSTRAINT fk_workflows_notebook
                               FOREIGN KEY (notebook_id)
                                   REFERENCES notebooks(id)
                                   ON DELETE CASCADE,

                           CONSTRAINT chk_workflows_status
                               CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED'))
);

CREATE INDEX idx_workflows_notebook_id
    ON workflows (notebook_id);

CREATE INDEX idx_workflows_status
    ON workflows (status);

CREATE INDEX idx_workflows_created_at
    ON workflows (created_at DESC);

-- =========================================================
-- WORKFLOW BLOCKS
-- =========================================================
CREATE TABLE workflow_blocks (
                                 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                 workflow_id UUID NOT NULL,
                                 type VARCHAR(50) NOT NULL,
                                 name VARCHAR(255) NOT NULL,
                                 position JSONB NOT NULL,
                                 config JSONB NOT NULL DEFAULT '{}'::jsonb,
                                 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                                 CONSTRAINT fk_workflow_blocks_workflow
                                     FOREIGN KEY (workflow_id)
                                         REFERENCES workflows(id)
                                         ON DELETE CASCADE,

                                 CONSTRAINT chk_workflow_blocks_type
                                     CHECK (
                                         type IN (
                                                  'START',
                                                  'INPUT',
                                                  'TEXT_PROCESS',
                                                  'API_CALL',
                                                  'LLM',
                                                  'ML',
                                                  'CONDITION',
                                                  'OUTPUT',
                                                  'END'
                                             )
                                         )
);

CREATE INDEX idx_workflow_blocks_workflow_id
    ON workflow_blocks (workflow_id);

CREATE INDEX idx_workflow_blocks_type
    ON workflow_blocks (type);

-- =========================================================
-- WORKFLOW CONNECTIONS
-- =========================================================
CREATE TABLE workflow_connections (
                                      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                      workflow_id UUID NOT NULL,
                                      from_block_id UUID NOT NULL,
                                      to_block_id UUID NOT NULL,
                                      condition TEXT,
                                      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                                      CONSTRAINT fk_workflow_connections_workflow
                                          FOREIGN KEY (workflow_id)
                                              REFERENCES workflows(id)
                                              ON DELETE CASCADE,

                                      CONSTRAINT fk_workflow_connections_from_block
                                          FOREIGN KEY (from_block_id)
                                              REFERENCES workflow_blocks(id)
                                              ON DELETE CASCADE,

                                      CONSTRAINT fk_workflow_connections_to_block
                                          FOREIGN KEY (to_block_id)
                                              REFERENCES workflow_blocks(id)
                                              ON DELETE CASCADE
);

CREATE INDEX idx_workflow_connections_workflow_id
    ON workflow_connections (workflow_id);

CREATE INDEX idx_workflow_connections_from_block_id
    ON workflow_connections (from_block_id);

CREATE INDEX idx_workflow_connections_to_block_id
    ON workflow_connections (to_block_id);

-- =========================================================
-- EXECUTIONS
-- =========================================================
CREATE TABLE executions (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            workflow_id UUID NOT NULL,
                            started_by_user_id UUID,
                            status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
                            input_data JSONB,
                            output_data JSONB,
                            error_message TEXT,
                            started_at TIMESTAMPTZ,
                            finished_at TIMESTAMPTZ,
                            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                            CONSTRAINT fk_executions_workflow
                                FOREIGN KEY (workflow_id)
                                    REFERENCES workflows(id)
                                    ON DELETE CASCADE,

                            CONSTRAINT chk_executions_status
                                CHECK (status IN ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED'))
);

CREATE INDEX idx_executions_workflow_id
    ON executions (workflow_id);

CREATE INDEX idx_executions_started_by_user_id
    ON executions (started_by_user_id);

CREATE INDEX idx_executions_status
    ON executions (status);

CREATE INDEX idx_executions_created_at
    ON executions (created_at DESC);

-- =========================================================
-- EXECUTION LOGS
-- =========================================================
CREATE TABLE execution_logs (
                                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                execution_id UUID NOT NULL,
                                block_id UUID NOT NULL,
                                status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
                                output JSONB,
                                error TEXT,
                                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                                CONSTRAINT fk_execution_logs_execution
                                    FOREIGN KEY (execution_id)
                                        REFERENCES executions(id)
                                        ON DELETE CASCADE,

                                CONSTRAINT fk_execution_logs_block
                                    FOREIGN KEY (block_id)
                                        REFERENCES workflow_blocks(id)
                                        ON DELETE CASCADE,

                                CONSTRAINT chk_execution_logs_status
                                    CHECK (status IN ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED'))
);

CREATE INDEX idx_execution_logs_execution_id
    ON execution_logs (execution_id);

CREATE INDEX idx_execution_logs_block_id
    ON execution_logs (block_id);

CREATE INDEX idx_execution_logs_status
    ON execution_logs (status);

CREATE INDEX idx_execution_logs_created_at
    ON execution_logs (created_at DESC);
