package com.aziz.tbibi.tbibi_backend.security;

import com.aziz.tbibi.tbibi_backend.entities.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

// @Component = tells Spring to create ONE instance of this class
// and share it wherever it is needed (AuthService, JwtFilter...)
@Component
public class JwtUtil {

    // @Value reads the value from application.properties
    // app.jwt.secret = the private key used to sign tokens
    @Value("${app.jwt.secret}")
    private String secret;

    // app.jwt.expiration = how many milliseconds the token is valid
    // 86400000 = 24 hours
    @Value("${app.jwt.expiration}")
    private long expirationMs;

    // ─── Private helper ───────────────────────────────────────────
    // Creates a cryptographic key from our secret string
    // HMAC-SHA256 = the algorithm that signs the token
    // Keys.hmacShaKeyFor() = converts the string into a real key
    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(
            secret.getBytes(StandardCharsets.UTF_8)
        );
    }

    // ─── generateToken ────────────────────────────────────────────
    // Creates a JWT token for a given user.
    //
    // A JWT has 3 parts:  HEADER.PAYLOAD.SIGNATURE
    //   HEADER    = algorithm used (HS256)
    //   PAYLOAD   = data we store (userId, email, role, expiry)
    //   SIGNATURE = HMAC hash that proves the token was not tampered
    //
    // Example token (shortened):
    //   eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123
    public String generateToken(User user) {
        return Jwts.builder()
            // subject = who owns this token (the user's ID as a string)
            .subject(String.valueOf(user.getId()))
            // custom claims = extra data we embed in the token
            .claim("email", user.getEmail())
            .claim("role",  user.getRole().name())   // "PATIENT", "DOCTOR", or "ADMIN"
            // issuedAt = timestamp of when the token was created
            .issuedAt(new Date())
            // expiration = timestamp of when the token expires
            .expiration(new Date(System.currentTimeMillis() + expirationMs))
            // signWith = sign the token with our secret key
            .signWith(getSigningKey())
            // compact() = produces the final "eyJ..." string
            .compact();
    }

    // ─── validateToken ────────────────────────────────────────────
    // Returns true  = token is valid (correct signature, not expired)
    // Returns false = token is invalid or expired
    //
    // How it works: it tries to parse the token with our signing key.
    // If the signature doesn't match or the token is expired,
    // jjwt throws a JwtException and we catch it → return false.
    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                .verifyWith(getSigningKey())  // check the signature
                .build()
                .parseSignedClaims(token);    // parse and verify
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            // JwtException        = invalid signature or malformed token
            // IllegalArgumentException = empty or null token
            return false;
        }
    }

    // ─── extractClaims ────────────────────────────────────────────
    // Private helper: reads the payload (data) from inside the token.
    // Claims is a Map<String, Object> of all embedded data.
    private Claims extractClaims(String token) {
        return Jwts.parser()
            .verifyWith(getSigningKey())
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }

    // ─── extractUserId ────────────────────────────────────────────
    // Reads the user's ID from the token payload.
    // subject = the field we stored the userId in during generateToken()
    public Long extractUserId(String token) {
        return Long.valueOf(extractClaims(token).getSubject());
    }

    // ─── extractRole ──────────────────────────────────────────────
    // Reads the user's role ("PATIENT", "DOCTOR", "ADMIN") from the token.
    public String extractRole(String token) {
        return extractClaims(token).get("role", String.class);
    }
}
