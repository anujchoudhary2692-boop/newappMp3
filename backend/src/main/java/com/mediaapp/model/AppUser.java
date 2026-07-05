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
@Document(collection = "app_users")
public class AppUser {

    @Id
    private String id;

    @Indexed(unique = true)
    private String username;

    private String passwordHash;
    private UserRole role;
    private String orgId;
    private boolean active;

    private Instant createdAt;
    private Instant updatedAt;
}
