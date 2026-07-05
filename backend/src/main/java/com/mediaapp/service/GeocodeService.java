package com.mediaapp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class GeocodeService {

    private static final String USER_AGENT = "MediaFaceApp/1.0 (https://newappmp3.onrender.com)";

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public record GeocodeResult(String address, String city, String country) {}

    public Optional<GeocodeResult> reverseGeocode(double latitude, double longitude) {
        try {
            String url = String.format(
                    "https://nominatim.openstreetmap.org/reverse?format=json&lat=%f&lon=%f&zoom=16&addressdetails=1",
                    latitude, longitude);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(12))
                    .header("User-Agent", USER_AGENT)
                    .header("Accept", "application/json")
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 300) {
                return Optional.empty();
            }
            JsonNode data = objectMapper.readTree(response.body());
            JsonNode addressNode = data.path("address");
            String city = firstNonBlank(
                    text(addressNode, "city"),
                    text(addressNode, "town"),
                    text(addressNode, "village"),
                    text(addressNode, "suburb"),
                    text(addressNode, "county"));
            String country = text(addressNode, "country");
            String display = data.path("display_name").asText("");
            if (display.isBlank() && city == null && country == null) {
                return Optional.empty();
            }
            return Optional.of(new GeocodeResult(
                    display.isBlank() ? null : display,
                    city,
                    country));
        } catch (Exception e) {
            log.debug("Reverse geocode failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private static String text(JsonNode node, String field) {
        String value = node.path(field).asText("");
        return value.isBlank() ? null : value;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }
}
