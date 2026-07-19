package com.mediaapp.repository;

import com.mediaapp.model.UserLibrary;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface UserLibraryRepository extends MongoRepository<UserLibrary, String> {
    Optional<UserLibrary> findByUserId(String userId);
}
