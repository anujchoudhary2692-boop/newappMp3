package com.mediaapp.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mediaapp.dto.ApiResponse;
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
public class ApiKeyFilter extends OncePerRequestFilter {

    private static final Set<String> PUBLIC_PATHS = Set.of(
            "/",
            "/api/health",
            "/api/live",
            "/api/features",
            "/favicon.ico"
    );

    private final String apiKey;
    private final boolean requireApiKey;
    private final ObjectMapper objectMapper;

    public ApiKeyFilter(String apiKey, boolean requireApiKey, ObjectMapper objectMapper) {
        this.apiKey = apiKey;
        this.requireApiKey = requireApiKey;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!requireApiKey || apiKey == null || apiKey.isBlank()) {
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
        String provided = request.getHeader("X-API-Key");
        if (apiKey.equals(provided)) {
            filterChain.doFilter(request, response);
            return;
        }

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(
                response.getWriter(),
                ApiResponse.error("Invalid or missing API key"));
    }
}
