package com.mediaapp.dto;

import lombok.Data;

@Data
public class PushRegisterRequest {
    private String token;
    private String platform;
    private String deviceId;
}
