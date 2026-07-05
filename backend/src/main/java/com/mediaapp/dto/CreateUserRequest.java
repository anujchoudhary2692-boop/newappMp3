package com.mediaapp.dto;

import com.mediaapp.model.UserRole;
import lombok.Data;

@Data
public class CreateUserRequest {
    private String username;
    private String password;
    private UserRole role;
    private String orgId;
}
