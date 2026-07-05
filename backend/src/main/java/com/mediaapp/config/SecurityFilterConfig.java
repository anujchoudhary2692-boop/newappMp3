package com.mediaapp.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mediaapp.service.AuthService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

@Configuration
public class SecurityFilterConfig {

    @Bean
    public FilterRegistrationBean<AuthFilter> authFilter(
            AuthService authService,
            @Value("${app.auth.require-auth:false}") boolean requireAuth,
            ObjectMapper objectMapper) {
        FilterRegistrationBean<AuthFilter> bean = new FilterRegistrationBean<>();
        bean.setFilter(new AuthFilter(authService, requireAuth, objectMapper));
        bean.addUrlPatterns("/api/*");
        bean.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return bean;
    }

    @Bean
    public FilterRegistrationBean<ApiKeyFilter> apiKeyFilter(
            @Value("${app.security.api-key:}") String apiKey,
            @Value("${app.security.require-api-key:false}") boolean requireApiKey,
            ObjectMapper objectMapper) {
        FilterRegistrationBean<ApiKeyFilter> bean = new FilterRegistrationBean<>();
        bean.setFilter(new ApiKeyFilter(apiKey, requireApiKey, objectMapper));
        bean.addUrlPatterns("/api/*", "/files/*");
        bean.setOrder(Ordered.HIGHEST_PRECEDENCE + 1);
        return bean;
    }
}
