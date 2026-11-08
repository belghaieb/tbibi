package com.aziz.tbibi.tbibi_backend.config;

import com.aziz.tbibi.tbibi_backend.security.JwtFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

// @Configuration   = this class contains Spring configuration (beans)
// @EnableWebSecurity = activates Spring Security for the entire app
// @RequiredArgsConstructor = Lombok injects JwtFilter via constructor
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    // Our custom filter that validates JWT tokens on every request.
    // Spring injects this automatically since JwtFilter is a @Component.
    private final JwtFilter jwtFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // ── CSRF disabled ────────────────────────────────────
            // CSRF protection is for cookie-based sessions in browsers.
            // We use JWT tokens in headers → CSRF is not needed.
            .csrf(csrf -> csrf.disable())

            // ── CORS enabled ─────────────────────────────────────
            // Allows the frontend (localhost:5500) to call the backend (localhost:8084).
            // The actual CORS rules are in CorsConfig.java.
            .cors(Customizer.withDefaults())

            // ── Disable X-Frame-Options ───────────────────────────
            // Needed for iframes used in the app (e.g. file viewer).
            .headers(headers -> headers
                .frameOptions(frame -> frame.disable()))

            // ── Stateless session ─────────────────────────────────
            // STATELESS = Spring does NOT create HTTP sessions.
            // Every request must carry its own JWT token.
            // This is the correct approach for REST APIs.
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            // ── Route permissions ─────────────────────────────────
            // Rules are checked IN ORDER — first match wins.
            .authorizeHttpRequests(auth -> auth

                // PUBLIC routes — no token required
                // /api/auth/**     = login and register
                // /api/uploads/**  = file uploads at signup (called before token is saved)
                // /ws/**           = WebSocket connections (SockJS + STOMP)
                // /uploads/**      = serve uploaded files (avatars, documents)
                .requestMatchers(
                    "/api/auth/**",
                    "/api/uploads/**",
                    "/ws/**",
                    "/uploads/**"
                ).permitAll()

                // ADMIN-ONLY routes — only users with role ADMIN can access
                // /api/admin/** = user management, doctor verification, stats
                // hasRole("ADMIN") checks for authority "ROLE_ADMIN"
                // which we set in JwtFilter from the token's role claim
                .requestMatchers("/api/admin/**").hasRole("ADMIN")

                // ALL OTHER routes — any user with a valid token can access
                // This covers: /api/doctors, /api/appointments,
                //              /api/patients, /api/chats, /api/assistant,
                //              /api/nearby-medical, /api/subscriptions, etc.
                .anyRequest().authenticated()
            )

            // ── Add our JWT filter ────────────────────────────────
            // We insert JwtFilter BEFORE Spring's built-in login filter.
            // This means: our filter runs first, reads the token,
            // sets authentication — then Spring checks route permissions.
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    // ── PasswordEncoder bean ──────────────────────────────────────
    // BCrypt = the industry-standard password hashing algorithm.
    // "Admin123" → "$2a$10$xyz..." (different hash every time, cannot be reversed).
    //
    // We declare this as a @Bean so Spring can inject it anywhere
    // (AuthService, DataSeeder, etc.) without creating multiple instances.
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // Suppresses Spring's auto-generated password warning.
    // We use JWT — no need for Spring's built-in UserDetailsService.
    @Bean
    public UserDetailsService userDetailsService() {
        return username -> {
            throw new org.springframework.security.core.userdetails.UsernameNotFoundException("JWT auth only");
        };
    }
}
