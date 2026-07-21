package com.mediaapp.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class ProductionSecurityValidator {

    @Value("${spring.profiles.active:}")
    private String activeProfiles;

    @Value("${app.security.require-api-key:false}")
    private boolean requireApiKey;

    @Value("${app.security.api-key:}")
    private String apiKey;

    @Value("${app.cors.allowed-origins:*}")
    private String corsOrigins;

    @PostConstruct
    void validate() {
        boolean prod = activeProfiles != null && activeProfiles.contains("prod");
        if (!prod) {
            return;
        }
        if (requireApiKey && (apiKey == null || apiKey.isBlank())) {
            throw new IllegalStateException(
                    "Production requires API_KEY when REQUIRE_API_KEY=true. Set it on Render.");
        }
        if ("*".equals(corsOrigins.trim())) {
            log.warn("CORS_ALLOWED_ORIGINS=* — lock this to your domain for production.");
        }
        if (requireApiKey) {
            log.info("API key protection enabled for /api and /files");
        }
    }
}
