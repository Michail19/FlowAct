package com.ms.userservice.auth.service;

import com.ms.userservice.auth.dto.request.LoginRequest;
import com.ms.userservice.auth.dto.request.RefreshTokenRequest;
import com.ms.userservice.auth.dto.request.RegisterRequest;
import com.ms.userservice.auth.dto.response.AuthResponse;
import com.ms.userservice.auth.dto.response.TokenResponse;
import com.ms.userservice.common.exception.NotImplementedException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    public AuthResponse register(RegisterRequest request, HttpServletRequest servletRequest) {
        throw new NotImplementedException("User registration is not implemented yet");
    }

    public AuthResponse login(LoginRequest request, HttpServletRequest servletRequest) {
        throw new NotImplementedException("User login is not implemented yet");
    }

    public TokenResponse refresh(RefreshTokenRequest request, HttpServletRequest servletRequest) {
        throw new NotImplementedException("Token refresh is not implemented yet");
    }

    public void logout(RefreshTokenRequest request) {
        throw new NotImplementedException("Logout is not implemented yet");
    }
}
