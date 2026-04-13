package com.ms.executionservice.notebooks.service;

import com.ms.executionservice.common.exception.EntityNotFoundException;
import com.ms.executionservice.notebooks.dto.request.CreateNotebookRequest;
import com.ms.executionservice.notebooks.dto.request.UpdateNotebookRequest;
import com.ms.executionservice.notebooks.dto.response.NotebookResponse;
import com.ms.executionservice.notebooks.dto.response.NotebookShortResponse;
import com.ms.executionservice.notebooks.entity.NotebookEntity;
import com.ms.executionservice.notebooks.repository.NotebookRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class NotebookService {

    private final NotebookRepository notebookRepository;

    public NotebookService(NotebookRepository notebookRepository) {
        this.notebookRepository = notebookRepository;
    }

    @Transactional
    public NotebookResponse create(UUID ownerUserId, CreateNotebookRequest request) {
        NotebookEntity notebook = NotebookEntity.builder()
                .id(UUID.randomUUID())
                .ownerUserId(ownerUserId)
                .name(request.name())
                .description(request.description())
                .build();

        notebook = notebookRepository.save(notebook);

        return mapToNotebookResponse(notebook);
    }

    @Transactional(readOnly = true)
    public NotebookResponse getById(UUID ownerUserId, UUID notebookId) {
        NotebookEntity notebook = findNotebookByOwner(ownerUserId, notebookId);
        return mapToNotebookResponse(notebook);
    }

    @Transactional(readOnly = true)
    public List<NotebookShortResponse> getAll(UUID ownerUserId) {
        return notebookRepository.findByOwnerUserId(ownerUserId)
                .stream()
                .map(this::mapToNotebookShortResponse)
                .toList();
    }

    @Transactional
    public NotebookResponse update(UUID ownerUserId, UUID notebookId, UpdateNotebookRequest request) {
        NotebookEntity notebook = findNotebookByOwner(ownerUserId, notebookId);

        notebook.setName(request.name());
        notebook.setDescription(request.description());

        notebook = notebookRepository.save(notebook);

        return mapToNotebookResponse(notebook);
    }

    @Transactional
    public void delete(UUID ownerUserId, UUID notebookId) {
        NotebookEntity notebook = findNotebookByOwner(ownerUserId, notebookId);
        notebookRepository.delete(notebook);
    }

    private NotebookEntity findNotebookByOwner(UUID ownerUserId, UUID notebookId) {
        return notebookRepository.findByIdAndOwnerUserId(notebookId, ownerUserId)
                .orElseThrow(() -> new EntityNotFoundException("Notebook not found"));
    }

    private NotebookResponse mapToNotebookResponse(NotebookEntity notebook) {
        return NotebookResponse.builder()
                .id(notebook.getId())
                .ownerUserId(notebook.getOwnerUserId())
                .name(notebook.getName())
                .description(notebook.getDescription())
                .createdAt(notebook.getCreatedAt())
                .updatedAt(notebook.getUpdatedAt())
                .build();
    }

    private NotebookShortResponse mapToNotebookShortResponse(NotebookEntity notebook) {
        return NotebookShortResponse.builder()
                .id(notebook.getId())
                .ownerUserId(notebook.getOwnerUserId())
                .name(notebook.getName())
                .description(notebook.getDescription())
                .createdAt(notebook.getCreatedAt())
                .updatedAt(notebook.getUpdatedAt())
                .build();
    }
}
