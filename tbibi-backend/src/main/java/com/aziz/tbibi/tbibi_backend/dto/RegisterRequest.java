package com.aziz.tbibi.tbibi_backend.dto;

import com.aziz.tbibi.tbibi_backend.enums.Role;
import com.aziz.tbibi.tbibi_backend.enums.SubscriptionCode;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
// @Email      = validates that the string is a valid email format
// @NotBlank   = validates that the string is not empty or just spaces
// @NotNull    = validates that the value is not null
// these annotations automatically reject bad data before it reaches our service
import lombok.Data;

@Data
// @Data = Lombok generates getters and setters automatically
public class RegisterRequest {

    @NotBlank(message = "First name is required")
    private String firstName;

    @NotBlank(message = "Last name is required")
    private String lastName;

    @Email(message = "Email must be valid")
    @NotBlank(message = "Email is required")
    private String email;

    @NotBlank(message = "Password is required")
    private String password;

    private String phone;

    @NotNull(message = "Role is required")
    private Role role;
    // PATIENT or DOCTOR - sent by the frontend signup form

    @NotNull(message = "Subscription is required")
    private SubscriptionCode subscriptionCode;
    // BASIC or PREMIUM - chosen by user during signup

    // Doctor-only fields (ignored for PATIENT)
    private String specialty;
    private Integer experienceYears;
    private String bio;
}