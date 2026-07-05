package com.mediaapp.util;

import com.mediaapp.model.MediaType;

public final class MediaQualityPresets {

    private MediaQualityPresets() {}

    public static String normalizeAudio(String quality) {
        if (quality == null || quality.isBlank()) {
            return "320";
        }
        return switch (quality.trim().toLowerCase()) {
            case "128", "mp3_128", "audio_128" -> "128";
            case "m4a", "audio_m4a" -> "m4a";
            default -> "320";
        };
    }

    public static String normalizeVideo(String quality) {
        if (quality == null || quality.isBlank()) {
            return "720";
        }
        return switch (quality.trim().toLowerCase()) {
            case "360", "480", "sd", "video_360" -> "360";
            case "1080", "fhd", "video_1080" -> "1080";
            default -> "720";
        };
    }

    public static String normalize(MediaType type, String quality) {
        return type == MediaType.AUDIO ? normalizeAudio(quality) : normalizeVideo(quality);
    }

    public static String audioLabel(String preset) {
        return switch (normalizeAudio(preset)) {
            case "128" -> "MP3 · 128 kbps";
            case "m4a" -> "M4A · High quality";
            default -> "MP3 · 320 kbps";
        };
    }

    public static String videoLabel(String preset) {
        return switch (normalizeVideo(preset)) {
            case "360" -> "MP4 · 360p";
            case "1080" -> "MP4 · 1080p Full HD";
            default -> "MP4 · 720p HD";
        };
    }

    public static String ytDlpAudioFormat(String preset) {
        return switch (normalizeAudio(preset)) {
            case "128" -> "140/bestaudio[ext=m4a]/bestaudio/best";
            case "m4a" -> "140/bestaudio[ext=m4a]/bestaudio/best";
            default -> "140/bestaudio[ext=m4a]/bestaudio/best";
        };
    }

    public static String ytDlpVideoFormat(String preset) {
        int height = switch (normalizeVideo(preset)) {
            case "360" -> 360;
            case "1080" -> 1080;
            default -> 720;
        };
        if (height <= 360) {
            return "18/best[height<=360][ext=mp4][vcodec^=avc1]/best[height<=360][ext=mp4]/best[ext=mp4]/best";
        }
        return "best[height<=" + height + "][ext=mp4][vcodec^=avc1]/best[height<="
                + height + "][ext=mp4]/best[ext=mp4]/best";
    }

    public static String mp3QualityArg(String preset) {
        return "128".equals(normalizeAudio(preset)) ? "9" : "0";
    }
}
