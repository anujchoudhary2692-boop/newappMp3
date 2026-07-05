package com.mediaapp.repository;

import com.mediaapp.model.AuditLogEntry;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;

public interface AuditLogRepository extends MongoRepository<AuditLogEntry, String> {
    List<AuditLogEntry> findByCreatedAtAfterOrderByCreatedAtDesc(Instant since);
}
