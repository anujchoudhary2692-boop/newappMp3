package com.mediaapp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.mediaapp.dto.CaptureDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CaptureExportService {

    private final CaptureService captureService;
    private final ObjectMapper objectMapper;

    public String exportGeoJson() throws Exception {
        List<CaptureDto> captures = captureService.listGeoCaptures();
        ObjectNode fc = objectMapper.createObjectNode();
        fc.put("type", "FeatureCollection");
        ArrayNode features = fc.putArray("features");
        for (CaptureDto capture : captures) {
            if (capture.getLatitude() == null || capture.getLongitude() == null) {
                continue;
            }
            ObjectNode feature = objectMapper.createObjectNode();
            feature.put("type", "Feature");
            ObjectNode geometry = feature.putObject("geometry");
            geometry.put("type", "Point");
            ArrayNode coords = geometry.putArray("coordinates");
            coords.add(capture.getLongitude());
            coords.add(capture.getLatitude());
            ObjectNode props = feature.putObject("properties");
            props.put("id", capture.getId());
            props.put("type", capture.getType() != null ? capture.getType().name() : "PHOTO");
            props.put("locationLabel", capture.getLocationLabel());
            props.put("capturedAt", capture.getCapturedAt());
            props.put("scanStatus", capture.getScanStatus());
            props.put("matchCount", capture.getMatchCount() != null ? capture.getMatchCount() : 0);
            props.put("fileUrl", capture.getFileUrl());
            if (capture.getHeading() != null) {
                props.put("heading", capture.getHeading());
            }
            features.add(feature);

            if (capture.getTrackPointsJson() != null && !capture.getTrackPointsJson().isBlank()) {
                try {
                    var arr = objectMapper.readTree(capture.getTrackPointsJson());
                    if (arr.isArray() && arr.size() >= 2) {
                        ObjectNode lineFeature = objectMapper.createObjectNode();
                        lineFeature.put("type", "Feature");
                        ObjectNode lineGeom = lineFeature.putObject("geometry");
                        lineGeom.put("type", "LineString");
                        ArrayNode lineCoords = lineGeom.putArray("coordinates");
                        for (var n : arr) {
                            ArrayNode pair = lineCoords.addArray();
                            pair.add(n.path("lng").asDouble());
                            pair.add(n.path("lat").asDouble());
                        }
                        ObjectNode lineProps = lineFeature.putObject("properties");
                        lineProps.put("id", capture.getId() + "-track");
                        lineProps.put("type", "TRACK");
                        lineProps.put("captureId", capture.getId());
                        features.add(lineFeature);
                    }
                } catch (Exception ignored) {
                    // skip
                }
            }
        }
        return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(fc);
    }

    public String exportGpx() {
        List<CaptureDto> captures = captureService.listGeoCaptures();
        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<gpx version=\"1.1\" creator=\"MediaFaceApp\" xmlns=\"http://www.topografix.com/GPX/1/1\">\n");
        for (CaptureDto capture : captures) {
            if (capture.getLatitude() == null || capture.getLongitude() == null) {
                continue;
            }
            sb.append("  <wpt lat=\"").append(capture.getLatitude()).append("\" lon=\"")
                    .append(capture.getLongitude()).append("\">\n");
            if (capture.getAltitude() != null) {
                sb.append("    <ele>").append(capture.getAltitude()).append("</ele>\n");
            }
            if (capture.getCapturedAt() != null) {
                sb.append("    <time>").append(Instant.parse(capture.getCapturedAt())).append("</time>\n");
            }
            String name = capture.getLocationLabel() != null ? capture.getLocationLabel() : capture.getType().name();
            sb.append("    <name>").append(escapeXml(name)).append("</name>\n");
            sb.append("    <desc>").append(escapeXml(capture.getId())).append("</desc>\n");
            if (capture.getHeading() != null) {
                sb.append("    <extensions><heading>").append(capture.getHeading()).append("</heading></extensions>\n");
            }
            sb.append("  </wpt>\n");

            // Track LineString when video has track points
            if (capture.getTrackPointsJson() != null && !capture.getTrackPointsJson().isBlank()) {
                try {
                    var arr = objectMapper.readTree(capture.getTrackPointsJson());
                    if (arr.isArray() && arr.size() >= 2) {
                        sb.append("  <trk><name>").append(escapeXml(name)).append("</name><trkseg>\n");
                        for (var n : arr) {
                            double lat = n.path("lat").asDouble();
                            double lng = n.path("lng").asDouble();
                            sb.append("    <trkpt lat=\"").append(lat).append("\" lon=\"").append(lng).append("\">");
                            if (n.has("t")) {
                                sb.append("<time>").append(Instant.ofEpochMilli(n.path("t").asLong())).append("</time>");
                            }
                            sb.append("</trkpt>\n");
                        }
                        sb.append("  </trkseg></trk>\n");
                    }
                } catch (Exception ignored) {
                    // skip bad track json
                }
            }
        }
        sb.append("</gpx>\n");
        return sb.toString();
    }

    private static String escapeXml(String value) {
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
