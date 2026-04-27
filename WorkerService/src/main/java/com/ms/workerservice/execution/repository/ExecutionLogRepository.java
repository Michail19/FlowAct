package com.ms.workerservice.execution.repository;

import com.ms.workerservice.execution.entity.ExecutionLogEntity;
import com.ms.workerservice.execution.enumtype.ExecutionLogStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ExecutionLogRepository extends JpaRepository<ExecutionLogEntity, UUID> {
    List<ExecutionLogEntity> findByExecution_IdOrderByCreatedAtAsc(UUID executionId);
    List<ExecutionLogEntity> findByBlock_Id(UUID blockId);
    List<ExecutionLogEntity> findByStatus(ExecutionLogStatus status);
}
