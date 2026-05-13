package com.ms.executionservice.notebooks.controller;

import com.ms.executionservice.notebooks.dto.request.CreateNotebookRequest;
import com.ms.executionservice.notebooks.dto.request.UpdateNotebookRequest;
import com.ms.executionservice.notebooks.dto.response.NotebookResponse;
import com.ms.executionservice.notebooks.dto.response.NotebookShortResponse;
import com.ms.executionservice.notebooks.service.NotebookService;
import com.ms.executionservice.security.util.CurrentUserUtils;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
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
            Authentication authentication,
            @Valid @RequestBody CreateNotebookRequest request
    ) {
        UUID userId = CurrentUserUtils.getCurrentUserId(authentication);
        return notebookService.create(userId, request);
    }

    @GetMapping("/{notebookId}")
    public NotebookResponse getById(
            Authentication authentication,
            @PathVariable UUID notebookId
    ) {
        UUID userId = CurrentUserUtils.getCurrentUserId(authentication);
        return notebookService.getById(userId, notebookId);
    }

    @GetMapping
    public List<NotebookShortResponse> getAll(Authentication authentication) {
        UUID userId = CurrentUserUtils.getCurrentUserId(authentication);
        return notebookService.getAll(userId);
    }

    @PutMapping("/{notebookId}")
    public NotebookResponse update(
            Authentication authentication,
            @PathVariable UUID notebookId,
            @Valid @RequestBody UpdateNotebookRequest request
    ) {
        UUID userId = CurrentUserUtils.getCurrentUserId(authentication);
        return notebookService.update(userId, notebookId, request);
    }

    @DeleteMapping("/{notebookId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            Authentication authentication,
            @PathVariable UUID notebookId
    ) {
        UUID userId = CurrentUserUtils.getCurrentUserId(authentication);
        notebookService.delete(userId, notebookId);
    }
}
