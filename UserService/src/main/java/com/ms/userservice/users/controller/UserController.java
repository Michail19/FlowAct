package com.ms.userservice.users.controller;

import com.ms.userservice.security.util.CurrentUserUtils;
import com.ms.userservice.users.dto.request.UpdateCredentialsRequest;
import com.ms.userservice.users.dto.request.UpdateCurrentUserRequest;
import com.ms.userservice.users.dto.response.UserResponse;
import com.ms.userservice.users.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public UserResponse getCurrentUser(Authentication authentication) {
        UUID userId = CurrentUserUtils.getCurrentUserId(authentication);
        return userService.getCurrentUser(userId);
    }

    @PatchMapping("/me")
    public UserResponse updateCurrentUser(
            Authentication authentication,
            @Valid @RequestBody UpdateCurrentUserRequest request
    ) {
        UUID userId = CurrentUserUtils.getCurrentUserId(authentication);
        return userService.updateCurrentUser(userId, request);
    }

    @PostMapping("/me/change-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(
            Authentication authentication,
            @Valid @RequestBody UpdateCredentialsRequest request
    ) {
        UUID userId = CurrentUserUtils.getCurrentUserId(authentication);
        userService.updateCredentials(userId, request);
    }
}
