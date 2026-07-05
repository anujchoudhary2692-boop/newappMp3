package com.mediaapp.repository;

import com.mediaapp.model.PushDeviceToken;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface PushDeviceTokenRepository extends MongoRepository<PushDeviceToken, String> {
    Optional<PushDeviceToken> findByDeviceId(String deviceId);

    List<PushDeviceToken> findByOrgId(String orgId);
}
