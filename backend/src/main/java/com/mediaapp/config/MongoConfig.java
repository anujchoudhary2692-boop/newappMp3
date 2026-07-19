package com.mediaapp.config;

import org.springframework.boot.autoconfigure.mongo.MongoClientSettingsBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
public class MongoConfig {

    /** Keep cluster selection short so health checks fail fast when Atlas is unreachable. */
    @Bean
    public MongoClientSettingsBuilderCustomizer mongoTimeoutCustomizer() {
        return builder -> builder
                .applyToClusterSettings(cluster ->
                        cluster.serverSelectionTimeout(3, TimeUnit.SECONDS))
                .applyToSocketSettings(socket ->
                        socket.connectTimeout(3, TimeUnit.SECONDS)
                                .readTimeout(5, TimeUnit.SECONDS));
    }
}
