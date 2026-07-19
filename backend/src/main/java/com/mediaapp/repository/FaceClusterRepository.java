package com.mediaapp.repository;

import com.mediaapp.model.FaceCluster;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface FaceClusterRepository extends MongoRepository<FaceCluster, String> {
    List<FaceCluster> findAllByOrderByUpdatedAtDesc();
}
