package com.mediaapp.controller;

import com.mediaapp.dto.*;
import com.mediaapp.security.AuthContext;
import com.mediaapp.security.AuthContextHolder;
import com.mediaapp.service.AuditService;
import com.mediaapp.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final AuditService auditService;

    @GetMapping("/status")
    public ApiResponse<Map<String, Object>> status() {
        return ApiResponse.ok(Map.of(
                "authRequired", authService.isAuthRequired(),
                "roles", List.of("ADMIN", "OPERATOR", "VIEWER")));
    }

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@RequestBody LoginRequest body, HttpServletRequest request) {
        try {
            return ApiResponse.ok(authService.login(body.getUsername(), body.getPassword(), clientIp(request)));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            authService.logout(authHeader.substring(7));
        }
        return ApiResponse.ok("Logged out", null);
    }

    @GetMapping("/me")
    public ApiResponse<AuthUserDto> me() {
        AuthContext ctx = AuthContextHolder.get();
        if (ctx == null) {
            return ApiResponse.error("Not authenticated");
        }
        return ApiResponse.ok(AuthUserDto.builder()
                .id(ctx.getUserId())
                .username(ctx.getUsername())
                .role(ctx.getRole())
                .orgId(ctx.getOrgId())
                .build());
    }

    @GetMapping("/users")
    public ApiResponse<List<AuthUserDto>> listUsers() {
        try {
            return ApiResponse.ok(authService.listUsers(AuthContextHolder.get()));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PostMapping("/users")
    public ApiResponse<AuthUserDto> createUser(
            @RequestBody CreateUserRequest body,
            HttpServletRequest request) {
        try {
            return ApiResponse.ok(authService.createUser(body, AuthContextHolder.get(), clientIp(request)));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @GetMapping("/audit")
    public ApiResponse<List<AuditLogDto>> audit(@RequestParam(defaultValue = "100") int limit) {
        try {
            if (authService.isAuthRequired()) {
                AuthService.requireRole(AuthContextHolder.get(), com.mediaapp.model.UserRole.ADMIN);
            }
            return ApiResponse.ok(auditService.recent(limit));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
