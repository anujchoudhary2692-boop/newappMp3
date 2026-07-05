package com.mediaapp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.mediaapp.model.FaceMatchEvent;
import com.mediaapp.model.PushDeviceToken;
import com.mediaapp.repository.PushDeviceTokenRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PushNotificationService {

    private final PushDeviceTokenRepository tokenRepository;
    private final ObjectMapper objectMapper;
    private ExecutorService executor;
    private HttpClient httpClient;

    @Value("${app.push.fcm-project-id:}")
    private String fcmProjectId;

    @Value("${app.push.fcm-service-account-json:}")
    private String fcmServiceAccountJson;

    @PostConstruct
    void init() {
        executor = Executors.newFixedThreadPool(2);
        httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    @PreDestroy
    void shutdown() {
        if (executor != null) {
            executor.shutdownNow();
        }
    }

    public void registerToken(String token, String platform, String deviceId, String userId, String orgId) {
        if (token == null || token.isBlank() || deviceId == null || deviceId.isBlank()) {
            throw new IllegalArgumentException("Token and deviceId required");
        }
        PushDeviceToken existing = tokenRepository.findByDeviceId(deviceId).orElse(null);
        PushDeviceToken entry = PushDeviceToken.builder()
                .id(existing != null ? existing.getId() : null)
                .token(token.trim())
                .platform(platform != null ? platform : "unknown")
                .deviceId(deviceId.trim())
                .userId(userId)
                .orgId(orgId)
                .updatedAt(Instant.now())
                .build();
        tokenRepository.save(entry);
    }

    public void notifyMatch(FaceMatchEvent event) {
        if (fcmProjectId == null || fcmProjectId.isBlank()
                || fcmServiceAccountJson == null || fcmServiceAccountJson.isBlank()) {
            return;
        }
        List<PushDeviceToken> tokens = tokenRepository.findAll();
        if (tokens.isEmpty()) {
            return;
        }
        String title = "Person sighted: " + event.getPersonName();
        String body = Math.round(event.getConfidence()) + "% match"
                + (event.getLocationLabel() != null ? " · " + event.getLocationLabel() : "");
        for (PushDeviceToken device : tokens) {
            executor.submit(() -> sendFcm(device.getToken(), title, body, event));
        }
    }

    private void sendFcm(String deviceToken, String title, String body, FaceMatchEvent event) {
        try {
            String accessToken = fetchGoogleAccessToken();
            if (accessToken == null) {
                return;
            }
            ObjectNode message = objectMapper.createObjectNode();
            message.put("token", deviceToken);
            ObjectNode notification = message.putObject("notification");
            notification.put("title", title);
            notification.put("body", body);
            message.set("data", objectMapper.valueToTree(event));

            ObjectNode payload = objectMapper.createObjectNode();
            payload.set("message", message);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://fcm.googleapis.com/v1/projects/"
                            + fcmProjectId.trim() + "/messages:send"))
                    .timeout(Duration.ofSeconds(15))
                    .header("Authorization", "Bearer " + accessToken)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(payload.toString()))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 300) {
                log.warn("FCM push failed ({}): {}", response.statusCode(), response.body());
            }
        } catch (Exception e) {
            log.debug("FCM push error: {}", e.getMessage());
        }
    }

    private String fetchGoogleAccessToken() {
        try {
            JsonNode sa = objectMapper.readTree(fcmServiceAccountJson);
            String clientEmail = sa.get("client_email").asText();
            String privateKeyPem = sa.get("private_key").asText();
            String scope = "https://www.googleapis.com/auth/firebase.messaging";
            long now = Instant.now().getEpochSecond();
            String header = base64Url("{\"alg\":\"RS256\",\"typ\":\"JWT\"}");
            String claim = base64Url(String.format(
                    "{\"iss\":\"%s\",\"scope\":\"%s\",\"aud\":\"https://oauth2.googleapis.com/token\","
                            + "\"exp\":%d,\"iat\":%d}",
                    clientEmail, scope, now + 3600, now));
            String unsigned = header + "." + claim;
            String signature = signRs256(unsigned, privateKeyPem);
            String jwt = unsigned + "." + signature;

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://oauth2.googleapis.com/token"))
                    .timeout(Duration.ofSeconds(12))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(
                            "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + jwt))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 300) {
                log.warn("Google OAuth token failed: {}", response.statusCode());
                return null;
            }
            return objectMapper.readTree(response.body()).get("access_token").asText();
        } catch (Exception e) {
            log.warn("Could not fetch Google access token: {}", e.getMessage());
            return null;
        }
    }

    private static String signRs256(String data, String privateKeyPem) throws Exception {
        String normalized = privateKeyPem
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");
        byte[] keyBytes = Base64.getDecoder().decode(normalized);
        PrivateKey privateKey = KeyFactory.getInstance("RSA")
                .generatePrivate(new PKCS8EncodedKeySpec(keyBytes));
        Signature signature = Signature.getInstance("SHA256withRSA");
        signature.initSign(privateKey);
        signature.update(data.getBytes(StandardCharsets.UTF_8));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(signature.sign());
    }

    private static String base64Url(String value) {
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }
}
