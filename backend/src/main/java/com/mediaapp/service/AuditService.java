package com.mediaapp.service;

import com.mediaapp.dto.AuditLogDto;
import com.mediaapp.model.AuditLogEntry;
import com.mediaapp.model.UserRole;
import com.mediaapp.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    public void record(
            String action,
            String actorUserId,
            String actorUsername,
            UserRole actorRole,
            String targetType,
            String targetId,
            String details,
            String ipAddress,
            String orgId) {
        auditLogRepository.save(AuditLogEntry.builder()
                .action(action)
                .actorUserId(actorUserId)
                .actorUsername(actorUsername)
                .actorRole(actorRole)
                .targetType(targetType)
                .targetId(targetId)
                .details(details)
                .ipAddress(ipAddress)
                .orgId(orgId)
                .createdAt(Instant.now())
                .build());
    }

    public List<AuditLogDto> recent(int limit) {
        Instant since = Instant.now().minusSeconds(86400 * 30L);
        return auditLogRepository.findByCreatedAtAfterOrderByCreatedAtDesc(since).stream()
                .limit(Math.max(1, Math.min(limit, 500)))
                .map(this::toDto)
                .toList();
    }

    private AuditLogDto toDto(AuditLogEntry entry) {
        return AuditLogDto.builder()
                .id(entry.getId())
                .action(entry.getAction())
                .actorUsername(entry.getActorUsername())
                .actorRole(entry.getActorRole() != null ? entry.getActorRole().name() : null)
                .targetType(entry.getTargetType())
                .targetId(entry.getTargetId())
                .details(entry.getDetails())
                .ipAddress(entry.getIpAddress())
                .createdAt(entry.getCreatedAt())
                .build();
    }
}
