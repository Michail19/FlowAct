package com.ms.executionservice.workflow.repository;

import com.ms.executionservice.workflow.entity.WorkflowEntity;
import com.ms.executionservice.workflow.enumtype.WorkflowStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WorkflowRepository extends JpaRepository<WorkflowEntity, UUID> {
    List<WorkflowEntity> findByNotebook_Id(UUID notebookId);
    List<WorkflowEntity> findByStatus(WorkflowStatus status);
    Optional<WorkflowEntity> findByIdAndNotebook_Id(UUID workflowId, UUID notebookId);
    boolean existsByIdAndNotebook_Id(UUID workflowId, UUID notebookId);
}
