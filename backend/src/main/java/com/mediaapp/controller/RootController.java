package com.mediaapp.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/** Lightweight root response for Render port checks and browser visits. */
@RestController
public class RootController {

    @RequestMapping(value = {"/", ""}, method = {RequestMethod.GET, RequestMethod.HEAD})
    public ResponseEntity<Map<String, String>> root() {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("app", "MediaFace");
        body.put("status", "UP");
        body.put("health", "/api/health");
        return ResponseEntity.ok(body);
    }

    @GetMapping("/favicon.ico")
    public ResponseEntity<Void> favicon() {
        return ResponseEntity.noContent().build();
    }
}
