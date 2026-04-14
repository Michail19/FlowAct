package com.ms.workerservice.workflow.repository;

import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WorkflowBlockRepository extends JpaRepository<WorkflowBlockEntity, UUID> {
    List<WorkflowBlockEntity> findByWorkflow_Id(UUID workflowId);
    List<WorkflowBlockEntity> findByWorkflow_IdAndType(UUID workflowId, BlockType type);
}
