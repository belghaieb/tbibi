package com.aziz.tbibi.tbibi_backend.dto;

import com.aziz.tbibi.tbibi_backend.enums.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// LoginResponse = the JSON object we send back after a successful login or register.
//
// Frontend (login-page.js) receives this and:
//   1. Saves accessToken → localStorage["tbibi_access_token"]
//   2. Saves the whole object → localStorage["tbibi_user"]
//   3. Reads role → decides which page to navigate to
//
// On every subsequent request, the frontend sends:
//   Authorization: Bearer <accessToken>
// and our JwtFilter validates it.
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class LoginResponse {

    private Long id;
    // the user's database ID
    // frontend stores this to know "who am I?" for API calls
    // example: /api/appointments/patient/3 uses this id

    private String firstName;
    private String lastName;
    private String email;

    private Role role;
    // PATIENT, DOCTOR, or ADMIN
    // frontend uses this to navigate to the correct page:
    //   ADMIN  → admin.html
    //   DOCTOR → main.html
    //   PATIENT → main.html

    private String subscriptionStatus;
    // "ACTIVE" or "EXPIRED" or "NONE"
    // frontend uses this to show/hide premium features

    private String subscriptionCode;
    // "BASIC" or "PREMIUM" or "NONE"
    // frontend uses this to show the correct plan name

    private String avatarUrl;
    // HTTP URL of the profile photo, e.g. "http://localhost:8084/uploads/avatars/user_3.jpg"
    // null until the user uploads a photo

    // ── NEW: JWT token ────────────────────────────────────────────
    // The JWT token that proves the user is authenticated.
    // Frontend stores this in localStorage and sends it on every request
    // in the Authorization header: "Bearer eyJhbGciOiJIUzI1NiJ9..."
    //
    // login-page.js reads: payload.accessToken → already implemented!
    private String accessToken;
}
