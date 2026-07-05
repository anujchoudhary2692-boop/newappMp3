package com.mediaapp.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "auth_sessions")
public class AuthSession {

    @Id
    private String id;

    @Indexed(unique = true)
    private String token;

    private String userId;
    private String username;
    private UserRole role;
    private String orgId;

    private Instant expiresAt;
    private Instant createdAt;
}
