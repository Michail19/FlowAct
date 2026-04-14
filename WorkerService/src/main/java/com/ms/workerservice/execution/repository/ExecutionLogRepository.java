package com.ms.executionservice.execution.repository;

import com.ms.executionservice.execution.entity.ExecutionLogEntity;
import com.ms.executionservice.execution.enumtype.ExecutionLogStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ExecutionLogRepository extends JpaRepository<ExecutionLogEntity, UUID> {
    List<ExecutionLogEntity> findByExecution_IdOrderByCreatedAtAsc(UUID executionId);
    List<ExecutionLogEntity> findByBlock_Id(UUID blockId);
    List<ExecutionLogEntity> findByStatus(ExecutionLogStatus status);
}
