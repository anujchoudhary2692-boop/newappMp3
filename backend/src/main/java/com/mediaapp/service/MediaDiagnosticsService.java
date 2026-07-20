package com.mediaapp.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class MediaDiagnosticsService {

    private final YtDlpService ytDlpService;

    @Value("${app.storage.downloads-dir:./storage/downloads}")
    private String downloadsDir;

    @Value("${RENDER:false}")
    private boolean renderHost;

    public Map<String, Object> snapshot() {
        Map<String, Object> media = new LinkedHashMap<>();
        media.put("ytDlp", ytDlpService.isAvailable() ? "UP" : "DOWN");
        media.put("ytDlpVersion", ytDlpService.getVersion());
        media.put("ffmpeg", isFfmpegAvailable() ? "UP" : "DOWN");
        media.put("youtubeCookies", ytDlpService.hasCookies() ? "CONFIGURED" : "MISSING");
        media.put("playDownload", computePlayDownloadStatus());
        media.put("cacheDirWritable", isCacheWritable());

        Map<String, Object> hints = new LinkedHashMap<>();
        if (!ytDlpService.hasCookies()) {
            hints.put("cloud", "Set YOUTUBE_COOKIES_BASE64 on Render for play/download when Mac is off.");
        }
        if (!ytDlpService.isAvailable()) {
            hints.put("ytDlp", "Install yt-dlp: brew install yt-dlp");
        }
        if (!hints.isEmpty()) {
            media.put("hints", hints);
        }
        return media;
    }

    public String overallMediaStatus() {
        if (!ytDlpService.isAvailable()) {
            return "DOWN";
        }
        if ("LIMITED".equals(computePlayDownloadStatus())) {
            return "DEGRADED";
        }
        return "UP";
    }

    private String computePlayDownloadStatus() {
        if (!ytDlpService.isAvailable()) {
            return "DOWN";
        }
        // Mac/local backends can play via yt-dlp iOS client profiles without cookies.
        // Cloud (Render) needs cookies because YouTube blocks datacenter IPs.
        if (renderHost && !ytDlpService.hasCookies()) {
            return "LIMITED";
        }
        return "UP";
    }

    private boolean isCacheWritable() {
        try {
            Path cache = Path.of(downloadsDir).resolve("cache");
            Files.createDirectories(cache);
            Path probe = cache.resolve(".write_probe");
            Files.writeString(probe, "ok");
            Files.deleteIfExists(probe);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private Boolean ffmpegCached;
    private long ffmpegCheckedAt;

    private boolean isFfmpegAvailable() {
        if (ffmpegCached != null && System.currentTimeMillis() - ffmpegCheckedAt < 60_000) {
            return ffmpegCached;
        }
        try {
            Process process = new ProcessBuilder("ffmpeg", "-version").start();
            boolean ok = process.waitFor(3, java.util.concurrent.TimeUnit.SECONDS) && process.exitValue() == 0;
            ffmpegCached = ok;
            ffmpegCheckedAt = System.currentTimeMillis();
            return ok;
        } catch (Exception e) {
            ffmpegCached = false;
            ffmpegCheckedAt = System.currentTimeMillis();
            return false;
        }
    }
}
