package com.ms.executionservice.notebooks.dto.response;

import lombok.Builder;

import java.time.OffsetDateTime;
import java.util.UUID;

@Builder
public record NotebookResponse(
        UUID id,
        UUID ownerUserId,
        String name,
        String description,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
