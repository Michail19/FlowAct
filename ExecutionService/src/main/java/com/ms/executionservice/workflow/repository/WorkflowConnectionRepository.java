package com.ms.executionservice.workflow.repository;

import com.ms.executionservice.workflow.entity.WorkflowConnectionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WorkflowConnectionRepository extends JpaRepository<WorkflowConnectionEntity, UUID> {
    List<WorkflowConnectionEntity> findByWorkflow_Id(UUID workflowId);
    List<WorkflowConnectionEntity> findByFromBlock_Id(UUID fromBlockId);
}
