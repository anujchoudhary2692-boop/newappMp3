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
            features.add(feature);
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
            sb.append("  </wpt>\n");
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
