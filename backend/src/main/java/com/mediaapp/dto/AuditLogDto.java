package com.mediaapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogDto {
    private String id;
    private String action;
    private String actorUsername;
    private String actorRole;
    private String targetType;
    private String targetId;
    private String details;
    private String ipAddress;
    private Instant createdAt;
}
