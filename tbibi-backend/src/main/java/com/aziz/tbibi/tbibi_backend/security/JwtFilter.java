package com.aziz.tbibi.tbibi_backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

// OncePerRequestFilter = Spring runs this class ONCE per HTTP request,
// before the request reaches the controller.
//
// What this filter does:
//   1. Reads the "Authorization" header from the request
//   2. Extracts the JWT token (everything after "Bearer ")
//   3. Validates the token with JwtUtil
//   4. If valid → tells Spring Security who the user is
//   5. Spring Security then enforces route permissions (SecurityConfig)
//
// Without this filter:
//   Spring Security doesn't know the user is authenticated
//   → returns 403 Forbidden on every protected route
@Component
@RequiredArgsConstructor
public class JwtFilter extends OncePerRequestFilter {

    // JwtUtil = our helper class that reads and validates tokens
    private final JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(
            HttpServletRequest  request,
            HttpServletResponse response,
            FilterChain         filterChain) throws ServletException, IOException {

        // ── Step 1: Read the Authorization header ─────────────────
        // Frontend sends: Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
        String authHeader = request.getHeader("Authorization");

        // Only process if header exists and starts with "Bearer "
        if (authHeader != null && authHeader.startsWith("Bearer ")) {

            // ── Step 2: Extract the token ──────────────────────────
            // Remove the "Bearer " prefix (7 characters) to get the raw token
            String token = authHeader.substring(7);

            // ── Step 3: Validate the token ─────────────────────────
            // validateToken() returns false if:
            //   - signature is wrong (someone tampered with the token)
            //   - token has expired (older than 24 hours)
            if (jwtUtil.validateToken(token)) {

                // ── Step 4: Extract user identity from the token ───
                Long   userId = jwtUtil.extractUserId(token);  // e.g. 3
                String role   = jwtUtil.extractRole(token);    // e.g. "DOCTOR"

                // ── Step 5: Create a Spring Security Authentication ─
                // UsernamePasswordAuthenticationToken = Spring's standard
                // way of representing "this user is authenticated"
                //
                // Parameters:
                //   principal   = the user ID (who is making the request)
                //   credentials = null (we don't store the password here)
                //   authorities = what this user is allowed to do
                //
                // "ROLE_" prefix is required by Spring Security
                // e.g. "ROLE_ADMIN", "ROLE_DOCTOR", "ROLE_PATIENT"
                UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(
                        userId,
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + role))
                    );

                // ── Step 6: Store in SecurityContext ───────────────
                // SecurityContextHolder = Spring's "current user" store
                // Once we set it here, all subsequent code in this request
                // can read who the user is (e.g. in controllers)
                SecurityContextHolder
                    .getContext()
                    .setAuthentication(authentication);
            }
        }

        // ── Step 7: Continue the request ──────────────────────────
        // Pass the request to the next filter or the controller
        // We ALWAYS do this — even if there was no token.
        // Routes that require auth will be blocked by SecurityConfig.
        filterChain.doFilter(request, response);
    }
}
