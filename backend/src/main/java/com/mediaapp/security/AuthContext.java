package com.mediaapp.security;

import com.mediaapp.model.UserRole;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class AuthContext {
    String userId;
    String username;
    UserRole role;
    String orgId;
}
