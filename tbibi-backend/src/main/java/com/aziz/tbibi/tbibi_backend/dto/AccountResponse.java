package com.aziz.tbibi.tbibi_backend.dto;

import com.aziz.tbibi.tbibi_backend.enums.Role;
import com.aziz.tbibi.tbibi_backend.enums.VerificationStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AccountResponse {

    // User basic info
    private Long id;
    private String firstName;
    private String lastName;
    private String email;
    private String phone;
    private Role role;
    // PATIENT or DOCTOR

    // Subscription info
    private String subscriptionCode;
    // "BASIC" or "PREMIUM"
    private String subscriptionStatus;
    // "ACTIVE" or "EXPIRED"

    // Doctor specific info
    // these fields are null if the user is a PATIENT
    private String specialty;
    // example: "Cardiologue", "Gynécologue"
    private Integer experienceYears;
    private String bio;
    private String avatarUrl;
    private VerificationStatus verificationStatus;
    // PENDING, VERIFIED or REJECTED
    // null if user is a PATIENT
}