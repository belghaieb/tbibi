package com.aziz.tbibi.tbibi_backend.controllers;

import com.aziz.tbibi.tbibi_backend.dto.LoginRequest;
import com.aziz.tbibi.tbibi_backend.dto.LoginResponse;
import com.aziz.tbibi.tbibi_backend.dto.RegisterRequest;
import com.aziz.tbibi.tbibi_backend.services.AuthService;
import com.aziz.tbibi.tbibi_backend.services.PasswordResetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;

    @PostMapping("/register")
    // handles POST requests to /api/auth/register
    public ResponseEntity<LoginResponse> register(
            @Valid @RequestBody RegisterRequest request) {
        // @Valid       = validate the request before processing
        // @RequestBody = read the JSON body sent by frontend

        LoginResponse response =
                authService.register(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
        // HttpStatus.CREATED = HTTP code 201
        // means "resource was successfully created"
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(
            @Valid @RequestBody LoginRequest request) {

        LoginResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    // ── POST /api/auth/forgot-password ────────────────────────────
    // Body: { "email": "user@example.com" }
    // Sends a reset link by email. Always returns 200 (no enumeration).
    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(
            @RequestBody Map<String, String> body) {

        String email = body.get("email");
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest()
                .body(Map.of("message", "L'adresse email est requise."));
        }

        try {
            passwordResetService.sendResetEmail(email.trim());
        } catch (Exception e) {
            return ResponseEntity.status(500)
                .body(Map.of("message", e.getMessage()));
        }

        return ResponseEntity.ok(Map.of("message", "Email envoyé si le compte existe."));
    }

    // ── GET /api/auth/validate-reset-token?token=XXX ─────────────
    // Returns 200 if valid, 400 if expired/invalid/already used.
    @GetMapping("/validate-reset-token")
    public ResponseEntity<Map<String, String>> validateResetToken(
            @RequestParam String token) {

        if (passwordResetService.isTokenValid(token)) {
            return ResponseEntity.ok(Map.of("valid", "true"));
        }
        return ResponseEntity.badRequest()
            .body(Map.of("message", "Lien invalide ou expiré."));
    }

    // ── POST /api/auth/reset-password ─────────────────────────────
    // Body: { "token": "xxx", "newPassword": "NewPass1!" }
    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(
            @RequestBody Map<String, String> body) {

        String token       = body.get("token");
        String newPassword = body.get("newPassword");

        if (token == null || newPassword == null) {
            return ResponseEntity.badRequest()
                .body(Map.of("message", "Token et nouveau mot de passe requis."));
        }

        try {
            passwordResetService.resetPassword(token, newPassword);
            return ResponseEntity.ok(Map.of("message", "Mot de passe mis à jour."));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                .body(Map.of("message", e.getMessage()));
        }
    }
}