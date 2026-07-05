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
@Document(collection = "push_device_tokens")
public class PushDeviceToken {

    @Id
    private String id;

    @Indexed
    private String token;

    private String platform;
    private String deviceId;
    private String userId;
    private String orgId;

    private Instant updatedAt;
}
