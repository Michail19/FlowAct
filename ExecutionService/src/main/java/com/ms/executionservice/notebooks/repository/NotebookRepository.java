package com.ms.executionservice.notebooks.repository;

import com.ms.executionservice.workflow.entity.NotebookEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotebookRepository extends JpaRepository<NotebookEntity, UUID> {
    List<NotebookEntity> findByOwnerUserId(UUID ownerUserId);
    Optional<NotebookEntity> findByIdAndOwnerUserId(UUID notebookId, UUID ownerUserId);
    boolean existsByIdAndOwnerUserId(UUID notebookId, UUID ownerUserId);
}
