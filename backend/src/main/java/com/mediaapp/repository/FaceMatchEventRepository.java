package com.mediaapp.repository;

import com.mediaapp.model.FaceMatchEvent;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;

public interface FaceMatchEventRepository extends MongoRepository<FaceMatchEvent, String> {
    List<FaceMatchEvent> findByPersonIdOrderByMatchedAtDesc(String personId);
    List<FaceMatchEvent> findByMatchedAtAfterOrderByMatchedAtDesc(Instant matchedAt);
}
