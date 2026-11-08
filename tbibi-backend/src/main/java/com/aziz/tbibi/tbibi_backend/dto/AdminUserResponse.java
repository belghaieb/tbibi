package com.aziz.tbibi.tbibi_backend.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class AdminUserResponse {
    private Long id;
    private String firstName;
    private String lastName;
    private String email;
    private String phone;
    private String role;
    private String avatarUrl;
    private LocalDateTime createdAt;

    // only filled when role == DOCTOR
    private String specialty;
    private String verificationStatus;
}
