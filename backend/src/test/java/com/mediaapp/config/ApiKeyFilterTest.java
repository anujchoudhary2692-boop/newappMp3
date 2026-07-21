package com.mediaapp.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class ApiKeyFilterTest {

    @Test
    void prefersHeaderOverQuery() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-API-Key", "from-header");
        request.setParameter("apiKey", "from-query");
        assertEquals("from-header", ApiKeyFilter.extractApiKey(request));
    }

    @Test
    void acceptsQueryParamForMediaPlayers() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setParameter("apiKey", "stream-key");
        assertEquals("stream-key", ApiKeyFilter.extractApiKey(request));
    }

    @Test
    void acceptsAuthorizationApiKeyScheme() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "ApiKey secret-value");
        assertEquals("secret-value", ApiKeyFilter.extractApiKey(request));
    }

    @Test
    void returnsNullWhenMissing() {
        assertNull(ApiKeyFilter.extractApiKey(new MockHttpServletRequest()));
    }
}
