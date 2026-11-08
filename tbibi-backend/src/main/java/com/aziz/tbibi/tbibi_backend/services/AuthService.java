package com.aziz.tbibi.tbibi_backend.services;

import com.aziz.tbibi.tbibi_backend.dto.LoginRequest;
import com.aziz.tbibi.tbibi_backend.dto.LoginResponse;
import com.aziz.tbibi.tbibi_backend.dto.RegisterRequest;
import com.aziz.tbibi.tbibi_backend.entities.DoctorProfile;
import com.aziz.tbibi.tbibi_backend.entities.Subscription;
import com.aziz.tbibi.tbibi_backend.entities.User;
import com.aziz.tbibi.tbibi_backend.entities.UserSubscription;
import com.aziz.tbibi.tbibi_backend.enums.Role;
import com.aziz.tbibi.tbibi_backend.repositories.DoctorProfileRepository;
import com.aziz.tbibi.tbibi_backend.repositories.SubscriptionRepository;
import com.aziz.tbibi.tbibi_backend.repositories.UserRepository;
import com.aziz.tbibi.tbibi_backend.repositories.UserSubscriptionRepository;
import com.aziz.tbibi.tbibi_backend.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

// @Service    = marks this class as business logic (not a controller or repo)
// @Transactional = if anything fails inside a method, ALL database changes
//                  are rolled back automatically — no incomplete data.
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository             userRepository;
    private final SubscriptionRepository     subscriptionRepository;
    private final UserSubscriptionRepository userSubscriptionRepository;
    private final DoctorProfileRepository    doctorProfileRepository;

    // PasswordEncoder = BCryptPasswordEncoder (defined as @Bean in SecurityConfig)
    // Injected by Spring — we do NOT create it with "new" to avoid
    // creating multiple instances and to respect Spring's lifecycle.
    private final PasswordEncoder passwordEncoder;

    // JwtUtil = our class that generates and validates JWT tokens
    private final JwtUtil jwtUtil;

    // ─── register ─────────────────────────────────────────────────
    // Creates a new user account and returns a ready-to-use JWT token.
    // The user is immediately logged in after registering — no need to
    // log in again.
    //
    // Steps:
    //   1. Check email is not already taken
    //   2. Hash the password and save the user
    //   3. Link them to their chosen subscription plan
    //   4. If doctor: create a DoctorProfile with PENDING status
    //   5. Generate a JWT token for the new user
    //   6. Return user info + token
    @Transactional
    public LoginResponse register(RegisterRequest request) {

        // Step 1: prevent duplicate accounts
        // existsByEmail uses case-sensitive SQL LIKE — we lowercase both sides
        if (userRepository.existsByEmail(request.getEmail().toLowerCase())) {
            throw new RuntimeException("Cet email est déjà utilisé");
        }

        // Step 2: create and save the user
        // passwordEncoder.encode() = hashes the password with BCrypt
        // Never store plain-text passwords!
        User user = User.builder()
            .firstName(request.getFirstName())
            .lastName(request.getLastName())
            .email(request.getEmail().toLowerCase())  // always store email lowercase
            .password(passwordEncoder.encode(request.getPassword()))
            .phone(request.getPhone())
            .role(request.getRole())
            .build();

        User savedUser = userRepository.save(user);

        // Step 3: assign a subscription plan to the user
        // Every user must choose a plan (BASIC or PREMIUM) at registration
        Subscription subscription = subscriptionRepository
            .findByCode(request.getSubscriptionCode())
            .orElseThrow(() -> new RuntimeException("Plan d'abonnement introuvable"));

        userSubscriptionRepository.save(
            UserSubscription.builder()
                .user(savedUser)
                .subscription(subscription)
                .startsAt(LocalDateTime.now())
                .status("ACTIVE")
                .build()
        );

        // Step 4: if the user is a doctor, create their profile
        // Doctors start as PENDING until an admin verifies their documents
        if (savedUser.getRole() == Role.DOCTOR) {
            doctorProfileRepository.save(
                DoctorProfile.builder()
                    .user(savedUser)
                    .specialty(request.getSpecialty() != null
                        ? request.getSpecialty()
                        : "Non précisé")
                    .experienceYears(request.getExperienceYears())
                    .bio(request.getBio())
                    .build()
            );
        }

        // Step 5: generate a JWT token so the user is immediately logged in
        String token = jwtUtil.generateToken(savedUser);

        // Step 6: build and return the response
        return LoginResponse.builder()
            .id(savedUser.getId())
            .firstName(savedUser.getFirstName())
            .lastName(savedUser.getLastName())
            .email(savedUser.getEmail())
            .role(savedUser.getRole())
            .avatarUrl(savedUser.getAvatarUrl())
            .subscriptionCode(subscription.getCode().name())
            .subscriptionStatus("ACTIVE")
            .accessToken(token)  // JWT token — frontend stores this
            .build();
    }

    // ─── login ────────────────────────────────────────────────────
    // Validates credentials and returns a JWT token on success.
    //
    // Steps:
    //   1. Find user by email (case-insensitive)
    //   2. Check password matches the stored hash
    //   3. Get active subscription info
    //   4. Generate JWT token
    //   5. Return user info + token
    public LoginResponse login(LoginRequest request) {

        // Step 1: find user — we say "invalid credentials" for both wrong
        // email and wrong password to not reveal which emails exist
        User user = userRepository
            .findByEmailIgnoreCase(request.getEmail())
            .orElseThrow(() -> new RuntimeException("Email ou mot de passe incorrect"));

        // Step 2: verify the password
        // passwordEncoder.matches() hashes the given password and compares
        // it to the stored hash — never compares plain text
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Email ou mot de passe incorrect");
        }

        // Step 3: find their active subscription (may be null for admin)
        UserSubscription userSubscription = userSubscriptionRepository
            .findByUserAndStatus(user, "ACTIVE")
            .orElse(null);

        // Step 4: generate a JWT token valid for 24 hours
        String token = jwtUtil.generateToken(user);

        // Step 5: build and return the response
        return LoginResponse.builder()
            .id(user.getId())
            .firstName(user.getFirstName())
            .lastName(user.getLastName())
            .email(user.getEmail())
            .role(user.getRole())
            .avatarUrl(user.getAvatarUrl())
            .subscriptionCode(
                userSubscription != null
                    ? userSubscription.getSubscription().getCode().name()
                    : "NONE"
            )
            .subscriptionStatus(
                userSubscription != null
                    ? userSubscription.getStatus()
                    : "NONE"
            )
            .accessToken(token)  // JWT token — frontend stores this in localStorage
            .build();
    }
}
