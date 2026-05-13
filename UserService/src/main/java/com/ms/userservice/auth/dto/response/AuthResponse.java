package com.ms.userservice.auth.dto.response;

import com.ms.userservice.users.dto.response.UserResponse;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        UserResponse user
) {
}
