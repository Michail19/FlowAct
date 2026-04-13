package com.ms.executionservice.notebooks.dto.request;

import jakarta.validation.constraints.NotBlank;

public record UpdateNotebookRequest(
        @NotBlank String name,
        String description
) {
}
