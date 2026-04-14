package com.ms.workerservice.execution.repository;

import com.ms.workerservice.execution.entity.ExecutionEntity;
import com.ms.workerservice.execution.enumtype.ExecutionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ExecutionRepository extends JpaRepository<ExecutionEntity, UUID> {
    List<ExecutionEntity> findByWorkflow_Id(UUID workflowId);
    List<ExecutionEntity> findByStartedByUserId(UUID startedByUserId);
    List<ExecutionEntity> findByStatus(ExecutionStatus status);
    Optional<ExecutionEntity> findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(
            UUID executionId,
            UUID workflowId,
            UUID notebookId
    );
    List<ExecutionEntity> findByWorkflow_IdOrderByCreatedAtDesc(UUID workflowId);
}
