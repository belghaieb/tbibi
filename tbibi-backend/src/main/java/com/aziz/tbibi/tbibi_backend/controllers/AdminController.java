package com.aziz.tbibi.tbibi_backend.controllers;

import com.aziz.tbibi.tbibi_backend.dto.AdminUserResponse;
import com.aziz.tbibi.tbibi_backend.entities.DoctorProfile;
import com.aziz.tbibi.tbibi_backend.entities.User;
import com.aziz.tbibi.tbibi_backend.enums.Role;
import com.aziz.tbibi.tbibi_backend.enums.VerificationStatus;
import com.aziz.tbibi.tbibi_backend.repositories.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// @RequestMapping("/api/admin") means all endpoints start with /api/admin
// SecurityConfig blocks anyone without role ADMIN from reaching this controller
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final UserRepository                 userRepository;
    private final DoctorProfileRepository        doctorProfileRepository;
    private final AppointmentRepository          appointmentRepository;
    private final ChatMessageRepository          chatMessageRepository;
    private final MedicalFileRepository          medicalFileRepository;
    private final DoctorVerificationDocRepository doctorVerificationDocRepository;
    private final UserSubscriptionRepository     userSubscriptionRepository;

    // ─── GET /api/admin/users ─────────────────────────────────────
    // Returns all users (patients + doctors + admins)
    // Used by the admin panel to display the users table
    @GetMapping("/users")
    public ResponseEntity<List<AdminUserResponse>> getAllUsers() {
        List<AdminUserResponse> users = userRepository.findAll()
            .stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }

    // ─── GET /api/admin/users/role/{role} ─────────────────────────
    // Returns users filtered by role: PATIENT, DOCTOR, or ADMIN
    // URL example: GET /api/admin/users/role/DOCTOR
    @GetMapping("/users/role/{role}")
    public ResponseEntity<List<AdminUserResponse>> getUsersByRole(
            @PathVariable String role) {
        Role r = Role.valueOf(role.toUpperCase());
        return ResponseEntity.ok(
            userRepository.findByRole(r)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList())
        );
    }

    // ─── GET /api/admin/doctors/pending ──────────────────────────
    // Returns doctors waiting for verification
    // FIX: was loading ALL doctors then filtering in memory (slow).
    // Now uses a proper database query via findByVerificationStatus().
    @GetMapping("/doctors/pending")
    public ResponseEntity<List<AdminUserResponse>> getPendingDoctors() {
        // findByVerificationStatus() = a single SQL query with WHERE clause
        // Much faster than findAll() + stream().filter() for large datasets
        List<AdminUserResponse> pending = doctorProfileRepository
            .findByVerificationStatus(VerificationStatus.PENDING)
            .stream()
            .map(profile -> toResponse(profile.getUser()))
            .collect(Collectors.toList());
        return ResponseEntity.ok(pending);
    }

    // ─── PUT /api/admin/doctors/{doctorId}/verify ─────────────────
    // Admin approves a doctor → status becomes VERIFIED
    // The doctor now appears in the patient's doctor list
    @PutMapping("/doctors/{doctorId}/verify")
    public ResponseEntity<Map<String, String>> verifyDoctor(
            @PathVariable Long doctorId) {
        User doctor = userRepository.findById(doctorId)
            .orElseThrow(() -> new RuntimeException("Médecin introuvable"));

        DoctorProfile profile = doctorProfileRepository.findByUser(doctor)
            .orElseThrow(() -> new RuntimeException("Profil médecin introuvable"));

        profile.setVerificationStatus(VerificationStatus.VERIFIED);
        doctorProfileRepository.save(profile);

        return ResponseEntity.ok(Map.of("message", "Médecin vérifié avec succès"));
    }

    // ─── PUT /api/admin/doctors/{doctorId}/reject ─────────────────
    // Admin rejects a doctor → status becomes REJECTED
    // The doctor is hidden from patients
    @PutMapping("/doctors/{doctorId}/reject")
    public ResponseEntity<Map<String, String>> rejectDoctor(
            @PathVariable Long doctorId) {
        User doctor = userRepository.findById(doctorId)
            .orElseThrow(() -> new RuntimeException("Médecin introuvable"));

        DoctorProfile profile = doctorProfileRepository.findByUser(doctor)
            .orElseThrow(() -> new RuntimeException("Profil médecin introuvable"));

        profile.setVerificationStatus(VerificationStatus.REJECTED);
        doctorProfileRepository.save(profile);

        return ResponseEntity.ok(Map.of("message", "Médecin rejeté"));
    }

    // ─── DELETE /api/admin/users/{id} ─────────────────────────────
    // Admin removes a user from the platform.
    //
    // FIX: Previously only deleted the DoctorProfile before deleting the user,
    // leaving orphaned records in other tables → database FK constraint errors.
    //
    // Now deletes ALL related data in the correct order:
    //   1. Appointments (patient or doctor side)
    //   2. Chat messages (sender or receiver)
    //   3. User subscriptions
    //   4. Doctor-specific: verification docs + profile
    //   5. Patient-specific: medical files
    //   6. The user itself
    //
    // @Transactional = if ANY step fails, ALL deletions are rolled back
    // No partial deletes — either everything is deleted or nothing is.
    @DeleteMapping("/users/{id}")
    @Transactional
    public ResponseEntity<Map<String, String>> deleteUser(@PathVariable Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

        // Step 1: delete appointments where this user is the patient or the doctor
        // Without this, deleting the user would fail with a FK constraint error
        appointmentRepository.deleteAll(
            appointmentRepository.findByPatientOrderByScheduledAtDesc(user)
        );
        appointmentRepository.deleteAll(
            appointmentRepository.findByDoctorOrderByScheduledAtDesc(user)
        );

        // Step 2: delete all chat messages this user sent or received
        chatMessageRepository.deleteAll(
            chatMessageRepository.findBySenderOrReceiver(user, user)
        );

        // Step 3: delete all subscription records for this user
        userSubscriptionRepository.deleteAll(
            userSubscriptionRepository.findByUser(user)
        );

        // Step 4: if doctor → delete their verification documents and profile
        if (user.getRole() == Role.DOCTOR) {
            doctorVerificationDocRepository.deleteAll(
                doctorVerificationDocRepository.findByDoctor(user)
            );
            doctorProfileRepository.findByUser(user)
                .ifPresent(doctorProfileRepository::delete);
        }

        // Step 5: if patient → delete their medical files (metadata only)
        // Note: actual files on disk are NOT deleted here — a future
        // improvement could add file cleanup with MedicalFileService
        if (user.getRole() == Role.PATIENT) {
            medicalFileRepository.deleteAll(
                medicalFileRepository.findByPatient(user)
            );
        }

        // Step 6: finally delete the user — all FKs are gone, safe to delete
        userRepository.delete(user);

        return ResponseEntity.ok(Map.of("message", "Utilisateur supprimé avec succès"));
    }

    // ─── GET /api/admin/doctors/{doctorId}/documents ─────────────
    // Returns the verification documents uploaded by a doctor at signup.
    // Each document has: id, docType, fileName, fileUrl, uploadedAt
    // fileUrl points to /uploads/doctor-docs/user_X/filename (served by WebMvcConfig)
    @GetMapping("/doctors/{doctorId}/documents")
    public ResponseEntity<List<Map<String, Object>>> getDoctorDocuments(
            @PathVariable Long doctorId) {
        User doctor = userRepository.findById(doctorId)
            .orElseThrow(() -> new RuntimeException("Médecin introuvable"));

        List<Map<String, Object>> docs = doctorVerificationDocRepository
            .findByDoctor(doctor)
            .stream()
            .map(doc -> {
                // storageKey = "uploads/doctor-docs/user_X/file.pdf"
                // public URL  = "/uploads/doctor-docs/user_X/file.pdf"
                String fileUrl = "/" + doc.getStorageKey().replace("\\", "/");
                String fileName = doc.getStorageKey().contains("/")
                    ? doc.getStorageKey().substring(doc.getStorageKey().lastIndexOf('/') + 1)
                    : doc.getStorageKey();
                // Strip UUID prefix (first 9 chars: "xxxxxxxx_")
                String displayName = fileName.length() > 9 ? fileName.substring(9) : fileName;

                return Map.<String, Object>of(
                    "id",         doc.getId(),
                    "docType",    doc.getDocType(),
                    "fileName",   displayName,
                    "fileUrl",    fileUrl,
                    "uploadedAt", doc.getCreatedAt()
                );
            })
            .collect(Collectors.toList());

        return ResponseEntity.ok(docs);
    }

    // ─── GET /api/admin/stats/monthly ────────────────────────────
    // Returns last 12 months of user registrations for the bar chart.
    // Each entry: { month: "Jan. 2026", count: 3 }
    @GetMapping("/stats/monthly")
    public ResponseEntity<List<Map<String, Object>>> getMonthlyStats() {
        var now = java.time.LocalDateTime.now();
        var monthNames = new String[]{"Jan.","Fév.","Mar.","Avr.","Mai","Jun.",
                                      "Jul.","Aoû.","Sep.","Oct.","Nov.","Déc."};
        List<Map<String, Object>> result = new java.util.ArrayList<>();

        for (int i = 11; i >= 0; i--) {
            var monthStart = now.minusMonths(i).withDayOfMonth(1)
                               .toLocalDate().atStartOfDay();
            var monthEnd = monthStart.plusMonths(1);
            int monthIndex = monthStart.getMonthValue() - 1;

            long count = userRepository.findAll().stream()
                .filter(u -> u.getCreatedAt() != null
                          && !u.getCreatedAt().isBefore(monthStart)
                          && u.getCreatedAt().isBefore(monthEnd))
                .count();

            result.add(Map.of(
                "month", monthNames[monthIndex] + " " + monthStart.getYear(),
                "count", count
            ));
        }
        return ResponseEntity.ok(result);
    }

    // ─── GET /api/admin/stats ─────────────────────────────────────
    // Returns quick stats for the admin dashboard cards.
    // FIX: was loading all doctors then counting in memory.
    // Now uses countByVerificationStatus() — a single COUNT(*) SQL query.
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Long>> getStats() {
        long totalUsers     = userRepository.count();
        long totalPatients  = userRepository.countByRole(Role.PATIENT);
        long totalDoctors   = userRepository.countByRole(Role.DOCTOR);
        long pendingDoctors = doctorProfileRepository
            .countByVerificationStatus(VerificationStatus.PENDING);

        return ResponseEntity.ok(Map.of(
            "totalUsers",    totalUsers,
            "totalPatients", totalPatients,
            "totalDoctors",  totalDoctors,
            "pendingDoctors", pendingDoctors
        ));
    }

    // ─── toResponse (private helper) ─────────────────────────────
    // Converts a User entity into an AdminUserResponse DTO.
    // For doctors, also adds specialty and verification status.
    private AdminUserResponse toResponse(User user) {
        AdminUserResponse.AdminUserResponseBuilder builder = AdminUserResponse.builder()
            .id(user.getId())
            .firstName(user.getFirstName())
            .lastName(user.getLastName())
            .email(user.getEmail())
            .phone(user.getPhone())
            .role(user.getRole().name())
            .avatarUrl(user.getAvatarUrl())
            .createdAt(user.getCreatedAt());

        if (user.getRole() == Role.DOCTOR) {
            doctorProfileRepository.findByUser(user).ifPresent(profile -> {
                builder.specialty(profile.getSpecialty());
                builder.verificationStatus(profile.getVerificationStatus().name());
            });
        }

        return builder.build();
    }
}
