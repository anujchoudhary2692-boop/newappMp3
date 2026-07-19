package com.mediaapp.repository;

import com.mediaapp.model.FaceIndexEntry;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface FaceIndexEntryRepository extends MongoRepository<FaceIndexEntry, String> {
    List<FaceIndexEntry> findByClusterId(String clusterId);
    List<FaceIndexEntry> findBySourceIdAndSourceType(String sourceId, String sourceType);
}
