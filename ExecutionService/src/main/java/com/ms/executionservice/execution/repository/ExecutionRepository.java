package com.ms.executionservice.execution.repository;

import com.ms.executionservice.execution.entity.ExecutionEntity;
import com.ms.executionservice.execution.enumtype.ExecutionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ExecutionRepository extends JpaRepository<ExecutionEntity, UUID> {
    List<ExecutionEntity> findByWorkflow_Id(UUID workflowId);
    List<ExecutionEntity> findByStartedByUserId(UUID startedByUserId);
    List<ExecutionEntity> findByStatus(ExecutionStatus status);
}
