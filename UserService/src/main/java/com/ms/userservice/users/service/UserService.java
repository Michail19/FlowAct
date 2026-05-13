package com.ms.userservice.users.service;

import com.ms.userservice.common.exception.NotFoundException;
import com.ms.userservice.users.dto.request.UpdateCurrentUserRequest;
import com.ms.userservice.users.dto.response.UserResponse;
import com.ms.userservice.users.entity.UserEntity;
import com.ms.userservice.users.mapper.UserMapper;
import com.ms.userservice.users.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;

    public UserService(UserRepository userRepository, UserMapper userMapper) {
        this.userRepository = userRepository;
        this.userMapper = userMapper;
    }

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser(UUID userId) {
        UserEntity user = findUserById(userId);
        return userMapper.toResponse(user);
    }

    @Transactional
    public UserResponse updateCurrentUser(UUID userId, UpdateCurrentUserRequest request) {
        UserEntity user = findUserById(userId);
        user.setDisplayName(normalizeDisplayName(request.displayName()));
        return userMapper.toResponse(userRepository.save(user));
    }

    private UserEntity findUserById(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    private String normalizeDisplayName(String displayName) {
        if (displayName == null || displayName.isBlank()) {
            return null;
        }
        return displayName.trim();
    }
}
