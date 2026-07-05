package com.mediaapp.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "audit_log")
public class AuditLogEntry {

    @Id
    private String id;

    private String action;
    private String actorUserId;
    private String actorUsername;
    private UserRole actorRole;
    private String targetType;
    private String targetId;
    private String details;
    private String ipAddress;
    private String orgId;

    private Instant createdAt;
}
