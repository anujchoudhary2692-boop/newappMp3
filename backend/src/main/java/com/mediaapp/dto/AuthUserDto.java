package com.mediaapp.dto;

import com.mediaapp.model.UserRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthUserDto {
    private String id;
    private String username;
    private UserRole role;
    private String orgId;
}
