package com.mediaapp.service;

import com.mediaapp.dto.AuthUserDto;
import com.mediaapp.dto.CreateUserRequest;
import com.mediaapp.dto.LoginResponse;
import com.mediaapp.model.AppUser;
import com.mediaapp.model.AuthSession;
import com.mediaapp.model.UserRole;
import com.mediaapp.repository.AppUserRepository;
import com.mediaapp.repository.AuthSessionRepository;
import com.mediaapp.security.AuthContext;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AppUserRepository userRepository;
    private final AuthSessionRepository sessionRepository;
    private final AuditService auditService;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Value("${app.auth.require-auth:false}")
    private boolean requireAuth;

    @Value("${app.auth.admin-username:}")
    private String adminUsername;

    @Value("${app.auth.admin-password:}")
    private String adminPassword;

    @Value("${app.auth.session-hours:168}")
    private int sessionHours;

    @PostConstruct
    void seedAdmin() {
        if (adminUsername == null || adminUsername.isBlank()
                || adminPassword == null || adminPassword.isBlank()) {
            return;
        }
        userRepository.findByUsernameIgnoreCase(adminUsername.trim()).orElseGet(() -> {
            AppUser admin = AppUser.builder()
                    .username(adminUsername.trim())
                    .passwordHash(passwordEncoder.encode(adminPassword))
                    .role(UserRole.ADMIN)
                    .orgId("default")
                    .active(true)
                    .createdAt(Instant.now())
                    .updatedAt(Instant.now())
                    .build();
            log.info("Seeded admin user: {}", admin.getUsername());
            return userRepository.save(admin);
        });
    }

    public boolean isAuthRequired() {
        return requireAuth;
    }

    public LoginResponse login(String username, String password, String ip) {
        AppUser user = userRepository.findByUsernameIgnoreCase(username.trim())
                .filter(AppUser::isActive)
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid credentials");
        }
        AuthSession session = createSession(user);
        auditService.record("LOGIN", user.getId(), user.getUsername(), user.getRole(),
                "USER", user.getId(), "User logged in", ip, user.getOrgId());
        return LoginResponse.builder()
                .token(session.getToken())
                .user(toDto(user))
                .build();
    }

    public Optional<AuthContext> resolveToken(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        return sessionRepository.findByTokenAndExpiresAtAfter(token.trim(), Instant.now())
                .map(s -> AuthContext.builder()
                        .userId(s.getUserId())
                        .username(s.getUsername())
                        .role(s.getRole())
                        .orgId(s.getOrgId())
                        .build());
    }

    public void logout(String token) {
        if (token == null || token.isBlank()) {
            return;
        }
        sessionRepository.findByTokenAndExpiresAtAfter(token.trim(), Instant.now())
                .ifPresent(sessionRepository::delete);
    }

    public AuthUserDto createUser(CreateUserRequest request, AuthContext actor, String ip) {
        requireRole(actor, UserRole.ADMIN);
        if (request.getUsername() == null || request.getUsername().isBlank()
                || request.getPassword() == null || request.getPassword().length() < 6) {
            throw new IllegalArgumentException("Username and password (6+ chars) required");
        }
        if (userRepository.findByUsernameIgnoreCase(request.getUsername().trim()).isPresent()) {
            throw new IllegalArgumentException("Username already exists");
        }
        UserRole role = request.getRole() != null ? request.getRole() : UserRole.VIEWER;
        String orgId = request.getOrgId() != null && !request.getOrgId().isBlank()
                ? request.getOrgId().trim()
                : actor.getOrgId();
        AppUser user = AppUser.builder()
                .username(request.getUsername().trim())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(role)
                .orgId(orgId)
                .active(true)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        user = userRepository.save(user);
        auditService.record("CREATE_USER", actor.getUserId(), actor.getUsername(), actor.getRole(),
                "USER", user.getId(), "Created user " + user.getUsername() + " (" + role + ")", ip, orgId);
        return toDto(user);
    }

    public List<AuthUserDto> listUsers(AuthContext actor) {
        requireRole(actor, UserRole.ADMIN);
        return userRepository.findAll().stream()
                .filter(u -> actor.getOrgId() == null || actor.getOrgId().equals(u.getOrgId()))
                .map(this::toDto)
                .toList();
    }

    public static void requireRole(AuthContext actor, UserRole minimum) {
        if (actor == null) {
            throw new IllegalStateException("Authentication required");
        }
        if (roleLevel(actor.getRole()) < roleLevel(minimum)) {
            throw new IllegalStateException("Insufficient permissions");
        }
    }

    public static boolean hasRole(AuthContext actor, UserRole minimum) {
        return actor != null && roleLevel(actor.getRole()) >= roleLevel(minimum);
    }

    private static int roleLevel(UserRole role) {
        if (role == null) {
            return 0;
        }
        return switch (role) {
            case VIEWER -> 1;
            case OPERATOR -> 2;
            case ADMIN -> 3;
        };
    }

    private AuthSession createSession(AppUser user) {
        sessionRepository.deleteByExpiresAtBefore(Instant.now());
        AuthSession session = AuthSession.builder()
                .token(UUID.randomUUID().toString().replace("-", ""))
                .userId(user.getId())
                .username(user.getUsername())
                .role(user.getRole())
                .orgId(user.getOrgId())
                .createdAt(Instant.now())
                .expiresAt(Instant.now().plus(sessionHours, ChronoUnit.HOURS))
                .build();
        return sessionRepository.save(session);
    }

    private AuthUserDto toDto(AppUser user) {
        return AuthUserDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .role(user.getRole())
                .orgId(user.getOrgId())
                .build();
    }
}
