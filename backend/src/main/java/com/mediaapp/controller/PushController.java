package com.mediaapp.controller;

import com.mediaapp.dto.ApiResponse;
import com.mediaapp.dto.PushRegisterRequest;
import com.mediaapp.security.AuthContext;
import com.mediaapp.security.AuthContextHolder;
import com.mediaapp.service.PushNotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
public class PushController {

    private final PushNotificationService pushNotificationService;

    @PostMapping("/register")
    public ApiResponse<Void> register(@RequestBody PushRegisterRequest body) {
        try {
            AuthContext ctx = AuthContextHolder.get();
            pushNotificationService.registerToken(
                    body.getToken(),
                    body.getPlatform(),
                    body.getDeviceId(),
                    ctx != null ? ctx.getUserId() : null,
                    ctx != null ? ctx.getOrgId() : null);
            return ApiResponse.ok("Push token registered", null);
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }
}
