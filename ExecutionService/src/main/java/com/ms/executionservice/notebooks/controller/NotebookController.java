package com.ms.executionservice.notebooks.controller;

import com.ms.executionservice.notebooks.dto.request.CreateNotebookRequest;
import com.ms.executionservice.notebooks.dto.request.UpdateNotebookRequest;
import com.ms.executionservice.notebooks.dto.response.NotebookResponse;
import com.ms.executionservice.notebooks.dto.response.NotebookShortResponse;
import com.ms.executionservice.notebooks.service.NotebookService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notebooks")
public class NotebookController {

    private final NotebookService notebookService;

    public NotebookController(NotebookService notebookService) {
        this.notebookService = notebookService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NotebookResponse create(
            @RequestHeader("X-User-Id") UUID userId,
            @Valid @RequestBody CreateNotebookRequest request
    ) {
        return notebookService.create(userId, request);
    }

    @GetMapping("/{notebookId}")
    public NotebookResponse getById(
            @RequestHeader("X-User-Id") UUID userId,
            @PathVariable UUID notebookId
    ) {
        return notebookService.getById(userId, notebookId);
    }

    @GetMapping
    public List<NotebookShortResponse> getAll(
            @RequestHeader("X-User-Id") UUID userId
    ) {
        return notebookService.getAll(userId);
    }

    @PutMapping("/{notebookId}")
    public NotebookResponse update(
            @RequestHeader("X-User-Id") UUID userId,
            @PathVariable UUID notebookId,
            @Valid @RequestBody UpdateNotebookRequest request
    ) {
        return notebookService.update(userId, notebookId, request);
    }

    @DeleteMapping("/{notebookId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @RequestHeader("X-User-Id") UUID userId,
            @PathVariable UUID notebookId
    ) {
        notebookService.delete(userId, notebookId);
    }
}
