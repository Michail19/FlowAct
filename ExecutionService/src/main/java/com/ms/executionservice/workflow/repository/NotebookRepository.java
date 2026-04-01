package com.ms.executionservice.workflow.repository;

import com.ms.executionservice.workflow.entity.NotebookEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface NotebookRepository extends JpaRepository<NotebookEntity, UUID> {
    List<NotebookEntity> findByOwnerUserId(UUID ownerUserId);
}
