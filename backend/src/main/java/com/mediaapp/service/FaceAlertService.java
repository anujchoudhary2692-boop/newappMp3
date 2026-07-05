package com.mediaapp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mediaapp.dto.PersonTimelineEntryDto;
import com.mediaapp.model.FaceMatchEvent;
import com.mediaapp.model.Person;
import com.mediaapp.model.PersonPhoto;
import com.mediaapp.repository.FaceMatchEventRepository;
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
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@Service
@RequiredArgsConstructor
public class FaceAlertService {

    private final FaceMatchEventRepository eventRepository;
    private final ObjectMapper objectMapper;
    private ExecutorService executor;
    private HttpClient httpClient;

    @Value("${app.face.alert-webhook-url:}")
    private String webhookUrl;

    @PostConstruct
    void init() {
        executor = Executors.newFixedThreadPool(2);
        httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();
    }

    @PreDestroy
    void shutdown() {
        if (executor != null) {
            executor.shutdownNow();
        }
    }

    public void recordMatch(Person person, PersonPhoto photo) {
        FaceMatchEvent event = eventRepository.save(FaceMatchEvent.builder()
                .personId(person.getId())
                .personName(person.getName())
                .photoId(photo.getId())
                .sourceType(photo.getSourceType())
                .confidence(photo.getConfidence())
                .locationLabel(photo.getLocationLabel())
                .latitude(photo.getLatitude())
                .longitude(photo.getLongitude())
                .captureId(photo.getCaptureId())
                .mediaVideoId(photo.getMediaVideoId())
                .mediaTitle(photo.getMediaTitle())
                .sourceTimestampMs(photo.getSourceTimestampMs())
                .matchedAt(photo.getMatchedAt() != null ? photo.getMatchedAt() : Instant.now())
                .build());

        if (webhookUrl != null && !webhookUrl.isBlank()) {
            executor.submit(() -> postWebhook(event));
        }
    }

    public List<PersonTimelineEntryDto> recentAudit(int limit) {
        Instant since = Instant.now().minusSeconds(86400 * 7);
        return eventRepository.findByMatchedAtAfterOrderByMatchedAtDesc(since).stream()
                .limit(Math.max(1, Math.min(limit, 500)))
                .map(e -> {
                    PersonTimelineEntryDto entry = PersonTimelineEntryDto.builder()
                            .id(e.getId())
                            .personId(e.getPersonId())
                            .personName(e.getPersonName())
                            .confidence(e.getConfidence())
                            .matchedAt(e.getMatchedAt() != null ? e.getMatchedAt().toString() : null)
                            .sourceType(e.getSourceType())
                            .sourceTimestampMs(e.getSourceTimestampMs())
                            .captureId(e.getCaptureId())
                            .mediaVideoId(e.getMediaVideoId())
                            .mediaTitle(e.getMediaTitle())
                            .latitude(e.getLatitude())
                            .longitude(e.getLongitude())
                            .locationLabel(e.getLocationLabel())
                            .build();
                    return entry;
                })
                .toList();
    }

    private void postWebhook(FaceMatchEvent event) {
        try {
            String body = objectMapper.writeValueAsString(event);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(webhookUrl.trim()))
                    .timeout(Duration.ofSeconds(12))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 300) {
                log.warn("Face alert webhook returned {}", response.statusCode());
            }
        } catch (Exception e) {
            log.debug("Face alert webhook failed: {}", e.getMessage());
        }
    }
}
