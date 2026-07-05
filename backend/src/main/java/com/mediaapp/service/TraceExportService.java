package com.mediaapp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.mediaapp.dto.PersonTimelineEntryDto;
import com.mediaapp.repository.PersonRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TraceExportService {

    private final FaceScanService faceScanService;
    private final PersonRepository personRepository;
    private final ObjectMapper objectMapper;

    public String exportPersonCsv(String personId, int limit) {
        String personName = personRepository.findById(personId).map(p -> p.getName()).orElse("unknown");
        List<PersonTimelineEntryDto> entries = faceScanService.getPersonTimeline(personId, limit);
        StringBuilder sb = new StringBuilder();
        sb.append("person_id,person_name,matched_at,source_type,confidence,location,latitude,longitude,capture_id,media_video_id,media_title,source_timestamp_ms\n");
        for (PersonTimelineEntryDto e : entries) {
            sb.append(csv(personId)).append(',')
                    .append(csv(personName)).append(',')
                    .append(csv(e.getMatchedAt())).append(',')
                    .append(csv(e.getSourceType())).append(',')
                    .append(e.getConfidence()).append(',')
                    .append(csv(e.getLocationLabel())).append(',')
                    .append(e.getLatitude() != null ? e.getLatitude() : "").append(',')
                    .append(e.getLongitude() != null ? e.getLongitude() : "").append(',')
                    .append(csv(e.getCaptureId())).append(',')
                    .append(csv(e.getMediaVideoId())).append(',')
                    .append(csv(e.getMediaTitle())).append(',')
                    .append(e.getSourceTimestampMs() != null ? e.getSourceTimestampMs() : "")
                    .append('\n');
        }
        return sb.toString();
    }

    public String exportPersonJson(String personId, int limit) throws Exception {
        List<PersonTimelineEntryDto> entries = faceScanService.getPersonTimeline(personId, limit);
        ObjectNode root = objectMapper.createObjectNode();
        root.put("personId", personId);
        personRepository.findById(personId).ifPresent(p -> root.put("personName", p.getName()));
        root.set("entries", objectMapper.valueToTree(entries));
        return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(root);
    }

    public String exportPersonGeoJson(String personId, int limit) throws Exception {
        List<PersonTimelineEntryDto> entries = faceScanService.getPersonTimeline(personId, limit);
        ObjectNode fc = objectMapper.createObjectNode();
        fc.put("type", "FeatureCollection");
        ArrayNode features = fc.putArray("features");
        for (PersonTimelineEntryDto e : entries) {
            if (e.getLatitude() == null || e.getLongitude() == null) {
                continue;
            }
            ObjectNode feature = objectMapper.createObjectNode();
            feature.put("type", "Feature");
            ObjectNode geometry = feature.putObject("geometry");
            geometry.put("type", "Point");
            ArrayNode coords = geometry.putArray("coordinates");
            coords.add(e.getLongitude());
            coords.add(e.getLatitude());
            ObjectNode props = feature.putObject("properties");
            props.put("personId", personId);
            props.put("matchedAt", e.getMatchedAt());
            props.put("sourceType", e.getSourceType());
            props.put("confidence", e.getConfidence());
            props.put("locationLabel", e.getLocationLabel());
            props.put("mediaTitle", e.getMediaTitle());
            features.add(feature);
        }
        return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(fc);
    }

    private static String csv(String value) {
        if (value == null) {
            return "";
        }
        String escaped = value.replace("\"", "\"\"");
        if (escaped.contains(",") || escaped.contains("\"") || escaped.contains("\n")) {
            return "\"" + escaped + "\"";
        }
        return escaped;
    }
}
