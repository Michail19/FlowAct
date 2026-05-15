package com.ms.userservice.users.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateCredentialsRequest(
        @NotBlank
        @Size(min = 8, max = 128)
        String currentSecret,

        @NotBlank
        @Size(min = 8, max = 128)
        String newSecret
) {
}
