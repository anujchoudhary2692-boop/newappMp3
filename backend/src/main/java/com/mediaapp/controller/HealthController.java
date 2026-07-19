package com.mediaapp.controller;

import com.mediaapp.dto.ApiResponse;
import com.mediaapp.service.MediaDiagnosticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class HealthController {

    private static final ExecutorService HEALTH_EXEC =
            Executors.newCachedThreadPool(r -> {
                Thread t = new Thread(r, "health-probe");
                t.setDaemon(true);
                return t;
            });

    private final MongoTemplate mongoTemplate;
    private final MediaDiagnosticsService mediaDiagnosticsService;

    /**
     * Instant liveness for client wake gates — never touches Mongo or yt-dlp.
     * Prefer this when only checking that the JVM/HTTP is up after Render sleep.
     */
    @GetMapping("/live")
    public ResponseEntity<ApiResponse<Map<String, Object>>> live() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("status", "UP");
        data.put("app", "MediaFace");
        return ResponseEntity.ok(ApiResponse.ok(data));
    }

    @GetMapping("/health")
    public ResponseEntity<ApiResponse<Map<String, Object>>> health() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("status", "UP");
        data.put("app", "MediaFace");

        // Mongo ping must not block wake forever (Atlas timeouts can exceed 20–30s).
        try {
            runWithTimeout(
                    () -> {
                        mongoTemplate.getDb().runCommand(new org.bson.Document("ping", 1));
                        return null;
                    },
                    2500);
            data.put("mongodb", "UP");
        } catch (Exception e) {
            data.put("mongodb", "DOWN");
            data.put("status", "DEGRADED");
            data.put("mongodbError", shortMsg(e));
        }

        try {
            Map<String, Object> media = runWithTimeout(mediaDiagnosticsService::snapshot, 4000);
            data.put("media", media);
            String mediaStatus = mediaDiagnosticsService.overallMediaStatus();
            data.put("mediaStatus", mediaStatus);
            if ("DOWN".equals(mediaStatus)) {
                data.put("status", "DEGRADED");
            } else if ("DEGRADED".equals(mediaStatus) && "UP".equals(data.get("status"))) {
                data.put("status", "DEGRADED");
            }
        } catch (Exception e) {
            Map<String, Object> media = new LinkedHashMap<>();
            media.put("ytDlp", "UNKNOWN");
            media.put("playDownload", "UNKNOWN");
            media.put("error", shortMsg(e));
            data.put("media", media);
            data.put("mediaStatus", "UNKNOWN");
            data.put("status", "DEGRADED");
        }

        return ResponseEntity.ok(ApiResponse.ok(data));
    }

    private static <T> T runWithTimeout(Callable<T> task, long timeoutMs) throws Exception {
        Future<T> future = HEALTH_EXEC.submit(task);
        try {
            return future.get(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            throw e;
        }
    }

    private static String shortMsg(Exception e) {
        Throwable cause = e;
        while (cause.getCause() != null && cause.getCause() != cause) {
            cause = cause.getCause();
        }
        String msg = cause.getMessage();
        if (msg == null || msg.isBlank()) {
            msg = cause.getClass().getSimpleName();
        }
        return msg.length() > 160 ? msg.substring(0, 160) : msg;
    }
}
