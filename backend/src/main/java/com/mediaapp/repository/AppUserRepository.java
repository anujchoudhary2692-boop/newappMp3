package com.mediaapp.repository;

import com.mediaapp.model.AppUser;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface AppUserRepository extends MongoRepository<AppUser, String> {
    Optional<AppUser> findByUsernameIgnoreCase(String username);
}
