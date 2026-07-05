package com.mediaapp.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class VideoFrameService {

    public record FrameSample(Path imagePath, long timestampMs) {}

    public List<FrameSample> extractFrames(Path videoPath, Long durationMs) throws Exception {
        if (!Files.exists(videoPath)) {
            throw new IllegalArgumentException("Video file missing");
        }
        long duration = durationMs != null && durationMs > 0
                ? durationMs
                : (long) (probeDurationSeconds(videoPath) * 1000);
        if (duration <= 0) {
            duration = 10000;
        }

        List<Long> timestamps = computeTimestamps(duration);
        Path tempDir = Files.createTempDirectory("face_frames_");
        List<FrameSample> frames = new ArrayList<>();
        try {
            for (Long ts : timestamps) {
                Path frame = tempDir.resolve("frame_" + ts + ".jpg");
                if (extractFrameAt(videoPath, ts, frame)) {
                    frames.add(new FrameSample(frame, ts));
                }
            }
            return frames;
        } catch (Exception e) {
            cleanupFrames(frames);
            Files.deleteIfExists(tempDir);
            throw e;
        }
    }

    public void cleanupFrames(List<FrameSample> frames) {
        if (frames == null) {
            return;
        }
        for (FrameSample frame : frames) {
            try {
                Files.deleteIfExists(frame.imagePath());
                Path parent = frame.imagePath().getParent();
                if (parent != null && Files.isDirectory(parent)) {
                    Files.deleteIfExists(parent);
                }
            } catch (Exception e) {
                log.debug("Could not delete temp frame: {}", e.getMessage());
            }
        }
    }

    private List<Long> computeTimestamps(long durationMs) {
        List<Long> timestamps = new ArrayList<>();
        if (durationMs <= 12000) {
            timestamps.add(0L);
            timestamps.add(Math.max(0, durationMs / 2));
        } else {
            timestamps.add(0L);
            timestamps.add(durationMs / 4);
            timestamps.add(durationMs / 2);
            timestamps.add((durationMs * 3) / 4);
        }
        return timestamps;
    }

    private boolean extractFrameAt(Path videoPath, long timestampMs, Path output) {
        double seconds = timestampMs / 1000.0;
        ProcessBuilder pb = new ProcessBuilder(
                "ffmpeg", "-hide_banner", "-loglevel", "error",
                "-ss", String.format("%.3f", seconds),
                "-i", videoPath.toString(),
                "-frames:v", "1",
                "-q:v", "2",
                "-y", output.toString());
        try {
            Process process = pb.start();
            boolean finished = process.waitFor(45, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                return false;
            }
            return process.exitValue() == 0 && Files.exists(output) && Files.size(output) > 0;
        } catch (Exception e) {
            log.debug("Frame extract failed at {}ms: {}", timestampMs, e.getMessage());
            return false;
        }
    }

    private double probeDurationSeconds(Path videoPath) {
        ProcessBuilder pb = new ProcessBuilder(
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                videoPath.toString());
        try {
            Process process = pb.start();
            boolean finished = process.waitFor(20, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                return 0;
            }
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line = reader.readLine();
                if (line != null && !line.isBlank()) {
                    return Double.parseDouble(line.trim());
                }
            }
        } catch (Exception e) {
            log.debug("ffprobe failed: {}", e.getMessage());
        }
        return 0;
    }
}
