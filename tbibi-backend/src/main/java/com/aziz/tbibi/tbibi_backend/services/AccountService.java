package com.aziz.tbibi.tbibi_backend.services;

import com.aziz.tbibi.tbibi_backend.dto.AccountResponse;
import com.aziz.tbibi.tbibi_backend.entities.DoctorProfile;
import com.aziz.tbibi.tbibi_backend.entities.User;
import com.aziz.tbibi.tbibi_backend.entities.UserSubscription;
import com.aziz.tbibi.tbibi_backend.enums.Role;
import com.aziz.tbibi.tbibi_backend.repositories.DoctorProfileRepository;
import com.aziz.tbibi.tbibi_backend.repositories.UserRepository;
import com.aziz.tbibi.tbibi_backend.repositories.UserSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import org.springframework.stereotype.Service;


@Service
@RequiredArgsConstructor
public class AccountService {

    private final UserRepository userRepository;
    private final DoctorProfileRepository doctorProfileRepository;
    private final UserSubscriptionRepository userSubscriptionRepository;
    private final PasswordEncoder passwordEncoder;

    public AccountResponse getAccount(Long userId) {
        // gets the full profile of the logged in user

        // Step 1: find the user in MySQL
        User user = userRepository.findById(userId)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));

        // Step 2: get active subscription
        Optional<UserSubscription> userSubscription =
                userSubscriptionRepository
                        .findByUserAndStatus(user, "ACTIVE");
        // Optional = a container that may or may not have a value
        // we use Optional here because subscription might not exist

        // Step 3: start building the response
        AccountResponse.AccountResponseBuilder response =
                AccountResponse.builder()
                        .id(user.getId())
                        .firstName(user.getFirstName())
                        .lastName(user.getLastName())
                        .email(user.getEmail())
                        .phone(user.getPhone())
                        .role(user.getRole())
                        .avatarUrl(user.getAvatarUrl())
                        // avatarUrl is on the User entity for all roles (PATIENT and DOCTOR)
                        .subscriptionCode(
                                userSubscription.isPresent() ?
                                        userSubscription.get()
                                                .getSubscription().getCode().name()
                                        : "NONE")
                        .subscriptionStatus(
                                userSubscription.isPresent() ?
                                        userSubscription.get().getStatus()
                                        : "NONE");

        // Step 4: if user is a DOCTOR add doctor specific info
        if (user.getRole() == Role.DOCTOR) {
            Optional<DoctorProfile> doctorProfile =
                    doctorProfileRepository.findByUser(user);

            if (doctorProfile.isPresent()) {
                DoctorProfile profile = doctorProfile.get();
                response
                        .specialty(profile.getSpecialty())
                        .experienceYears(profile.getExperienceYears())
                        .bio(profile.getBio())
                        .avatarUrl(profile.getAvatarUrl())
                        .verificationStatus(
                                profile.getVerificationStatus());
            }
        }
        // if user is a PATIENT these fields stay null
        // that is perfectly fine

        return response.build();
    }

    public AccountResponse updateAccount(Long userId,
                                         AccountResponse request) {
        // updates the profile of the logged in user

        // Step 1: find the user
        User user = userRepository.findById(userId)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));

        // Step 2: update basic fields
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setPhone(request.getPhone());
        // we do NOT update email or password here
        // those have their own dedicated endpoints

        // Step 3: save updated user
        userRepository.save(user);

        // Step 4: if doctor update doctor profile too
        if (user.getRole() == Role.DOCTOR) {
            Optional<DoctorProfile> doctorProfile =
                    doctorProfileRepository.findByUser(user);

            if (doctorProfile.isPresent()) {
                DoctorProfile profile = doctorProfile.get();
                profile.setSpecialty(request.getSpecialty());
                profile.setExperienceYears(
                        request.getExperienceYears());
                profile.setBio(request.getBio());
                doctorProfileRepository.save(profile);
            }
        }

        // Step 5: return updated account
        return getAccount(userId);
        // reuse getAccount() to build the fresh response
    }

    public void updatePassword(Long userId,
                               String currentPassword,
                               String newPassword) {
        // changes the password of the logged in user

        // Step 1: find the user
        User user = userRepository.findById(userId)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));

        // Step 2: verify current password is correct
        if (!passwordEncoder.matches(
                currentPassword, user.getPassword())) {
            throw new RuntimeException(
                    "Current password is incorrect");
        }

        // Step 3: hash and save new password
        user.setPassword(
                passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }
}