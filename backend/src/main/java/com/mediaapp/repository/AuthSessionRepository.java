package com.mediaapp.repository;

import com.mediaapp.model.AuthSession;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.Optional;

public interface AuthSessionRepository extends MongoRepository<AuthSession, String> {
    Optional<AuthSession> findByTokenAndExpiresAtAfter(String token, Instant now);

    void deleteByExpiresAtBefore(Instant cutoff);
}
