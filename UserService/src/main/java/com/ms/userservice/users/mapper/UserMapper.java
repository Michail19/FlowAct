package com.ms.userservice.users.mapper;

import com.ms.userservice.users.dto.response.UserResponse;
import com.ms.userservice.users.entity.UserEntity;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {

    public UserResponse toResponse(UserEntity user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getUsername(),
                user.getDisplayName(),
                user.getAvatarUrl(),
                user.getRole(),
                user.getStatus(),
                user.getAccountType(),
                user.getDemoExpiresAt(),
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }
}
