package com.mediaapp.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mediaapp.dto.ApiResponse;
import com.mediaapp.model.UserRole;
import com.mediaapp.security.AuthContext;
import com.mediaapp.security.AuthContextHolder;
import com.mediaapp.service.AuthService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

@Slf4j
public class AuthFilter extends OncePerRequestFilter {

    private static final Set<String> PUBLIC_PATHS = Set.of(
            "/api/health",
            "/api/auth/login",
            "/api/auth/status"
    );

    private final AuthService authService;
    private final boolean requireAuth;
    private final ObjectMapper objectMapper;

    public AuthFilter(AuthService authService, boolean requireAuth, ObjectMapper objectMapper) {
        this.authService = authService;
        this.requireAuth = requireAuth;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!requireAuth) {
            return true;
        }
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI();
        return PUBLIC_PATHS.contains(path);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        try {
            String authHeader = request.getHeader("Authorization");
            String token = null;
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                token = authHeader.substring(7);
            }
            AuthContext context = authService.resolveToken(token).orElse(null);
            if (context == null) {
                unauthorized(response, "Authentication required");
                return;
            }
            if (!isAllowed(context, request)) {
                forbidden(response, "Insufficient permissions");
                return;
            }
            AuthContextHolder.set(context);
            filterChain.doFilter(request, response);
        } finally {
            AuthContextHolder.clear();
        }
    }

    private boolean isAllowed(AuthContext context, HttpServletRequest request) {
        String method = request.getMethod().toUpperCase();
        String path = request.getRequestURI();

        if ("DELETE".equals(method) && path.startsWith("/api/auth/users")) {
            return AuthService.hasRole(context, UserRole.ADMIN);
        }
        if ("POST".equals(method) && path.startsWith("/api/auth/users")) {
            return AuthService.hasRole(context, UserRole.ADMIN);
        }
        if ("DELETE".equals(method) && path.startsWith("/api/faces")) {
            return AuthService.hasRole(context, UserRole.OPERATOR);
        }
        if ("POST".equals(method) && path.startsWith("/api/faces")) {
            return AuthService.hasRole(context, UserRole.OPERATOR);
        }
        if ("PATCH".equals(method) && path.startsWith("/api/faces")) {
            return AuthService.hasRole(context, UserRole.OPERATOR);
        }
        if ("POST".equals(method) && path.startsWith("/api/captures")) {
            return AuthService.hasRole(context, UserRole.OPERATOR);
        }
        return AuthService.hasRole(context, UserRole.VIEWER);
    }

    private void unauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), ApiResponse.error(message));
    }

    private void forbidden(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), ApiResponse.error(message));
    }
}
