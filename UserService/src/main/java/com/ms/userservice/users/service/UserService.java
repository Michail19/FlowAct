package com.ms.userservice.users.service;

import com.ms.userservice.common.exception.NotImplementedException;
import com.ms.userservice.users.dto.request.UpdateCurrentUserRequest;
import com.ms.userservice.users.dto.response.UserResponse;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class UserService {

    public UserResponse getCurrentUser(UUID userId) {
        throw new NotImplementedException("Current user loading is not implemented yet");
    }

    public UserResponse updateCurrentUser(UUID userId, UpdateCurrentUserRequest request) {
        throw new NotImplementedException("Current user update is not implemented yet");
    }
}
