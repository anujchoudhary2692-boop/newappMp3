package com.mediaapp.repository;

import com.mediaapp.model.PersonPhoto;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface PersonPhotoRepository extends MongoRepository<PersonPhoto, String> {
    List<PersonPhoto> findByPersonIdOrderByMatchedAtDesc(String personId);
    long countByPersonId(String personId);
    Optional<PersonPhoto> findByPersonIdAndDevicePhotoId(String personId, String devicePhotoId);
    List<PersonPhoto> findByMatchedAtAfterOrderByMatchedAtDesc(Instant matchedAt);
    void deleteByPersonId(String personId);
}
