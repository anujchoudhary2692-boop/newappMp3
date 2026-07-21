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
        if (!requireApiKey) {
            return true;
        }
        // Fail closed when production requires a key but none is configured.
        if (apiKey == null || apiKey.isBlank()) {
            return false;
        }
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI();
        return PUBLIC_PATHS.contains(path) || path.startsWith("/assets/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        if (apiKey == null || apiKey.isBlank()) {
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            objectMapper.writeValue(
                    response.getWriter(),
                    ApiResponse.error("Server misconfigured: API_KEY is required in production"));
            return;
        }

        String provided = extractApiKey(request);
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

    /** Header preferred; query param allowed for &lt;audio&gt;/&lt;video&gt; and players. */
    static String extractApiKey(HttpServletRequest request) {
        String header = request.getHeader("X-API-Key");
        if (header != null && !header.isBlank()) {
            return header.trim();
        }
        String auth = request.getHeader("Authorization");
        if (auth != null && auth.regionMatches(true, 0, "ApiKey ", 0, 7)) {
            return auth.substring(7).trim();
        }
        String queryKey = request.getParameter("apiKey");
        if (queryKey != null && !queryKey.isBlank()) {
            return queryKey.trim();
        }
        String shortKey = request.getParameter("key");
        if (shortKey != null && !shortKey.isBlank()) {
            return shortKey.trim();
        }
        return null;
    }
}
