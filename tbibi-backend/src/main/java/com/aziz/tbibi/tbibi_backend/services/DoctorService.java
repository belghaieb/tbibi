package com.aziz.tbibi.tbibi_backend.services;

import com.aziz.tbibi.tbibi_backend.dto.DoctorResponse;
import com.aziz.tbibi.tbibi_backend.entities.DoctorProfile;
import com.aziz.tbibi.tbibi_backend.entities.User;
import com.aziz.tbibi.tbibi_backend.enums.VerificationStatus;
import com.aziz.tbibi.tbibi_backend.repositories.DoctorProfileRepository;
import com.aziz.tbibi.tbibi_backend.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DoctorService {

    private final DoctorProfileRepository doctorProfileRepository;
    private final UserRepository          userRepository;
    private final UserPresenceService     presenceService;

    // ─── getAllDoctors ────────────────────────────────────────────
    // Returns ALL verified doctors.
    // Used by the left panel in the patient dashboard.
    // Only VERIFIED doctors are shown — PENDING and REJECTED are hidden.
    public List<DoctorResponse> getAllDoctors() {
        return doctorProfileRepository
            .findByVerificationStatus(VerificationStatus.VERIFIED)
            .stream()
            .map(this::mapToResponse)
            .collect(Collectors.toList());
    }

    // ─── getDoctorById ────────────────────────────────────────────
    // Returns ONE doctor's full profile given their USER ID.
    //
    // IMPORTANT FIX: the id here is the User.id (from LoginResponse),
    // NOT the DoctorProfile.id.
    //
    // Why? Because:
    //   - DoctorResponse.id = User.id (see mapToResponse below)
    //   - Frontend stores doctor.id = User.id in currentPartnerId
    //   - Frontend calls /api/doctors/{User.id} to get full profile
    //   - Frontend also uses User.id for chat and appointments
    public DoctorResponse getDoctorById(Long userId) {
        // Step 1: find the User by ID
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("Médecin introuvable"));

        // Step 2: find their DoctorProfile linked to that user
        DoctorProfile profile = doctorProfileRepository.findByUser(user)
            .orElseThrow(() -> new RuntimeException("Profil médecin introuvable"));

        return mapToResponse(profile);
    }

    // ─── getDoctorsBySpecialty ────────────────────────────────────
    // Returns doctors filtered by specialty AND only VERIFIED ones.
    // Previously returned ALL doctors of a specialty including
    // PENDING and REJECTED — that was a bug.
    public List<DoctorResponse> getDoctorsBySpecialty(String specialty) {
        return doctorProfileRepository
            // new repository method: filters by BOTH specialty AND VERIFIED status
            .findBySpecialtyAndVerificationStatus(specialty, VerificationStatus.VERIFIED)
            .stream()
            .map(this::mapToResponse)
            .collect(Collectors.toList());
    }

    // ─── mapToResponse (private helper) ──────────────────────────
    // Converts a DoctorProfile entity into a DoctorResponse DTO.
    // We reuse this in all three methods above.
    //
    // KEY FIX: id = profile.getUser().getId()  (the USER's ID)
    // Previously it was profile.getId() (DoctorProfile's ID) which caused:
    //   - Appointment booking to fail (looked up wrong ID in users table)
    //   - Chat to fail (sent message to wrong user ID)
    private DoctorResponse mapToResponse(DoctorProfile profile) {
        return DoctorResponse.builder()
            .id(profile.getUser().getId())     // ← User ID, NOT DoctorProfile ID
            .firstName(profile.getUser().getFirstName())
            .lastName(profile.getUser().getLastName())
            .specialty(profile.getSpecialty())
            .experienceYears(profile.getExperienceYears())
            .bio(profile.getBio())
            .avatarUrl(profile.getAvatarUrl())
            .verificationStatus(profile.getVerificationStatus())
            .isOnline(presenceService.isOnline(profile.getUser().getId()))
            .build();
    }
}
