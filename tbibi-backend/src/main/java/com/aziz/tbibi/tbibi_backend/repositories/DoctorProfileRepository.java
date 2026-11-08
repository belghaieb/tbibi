package com.aziz.tbibi.tbibi_backend.repositories;

import com.aziz.tbibi.tbibi_backend.entities.DoctorProfile;
import com.aziz.tbibi.tbibi_backend.entities.User;
import com.aziz.tbibi.tbibi_backend.enums.VerificationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DoctorProfileRepository extends JpaRepository<DoctorProfile, Long> {

    // Gets the profile linked to a specific user
    // SQL: SELECT * FROM doctor_profiles WHERE user_id = ?
    Optional<DoctorProfile> findByUser(User user);

    // Gets all profiles with a specific verification status
    // SQL: SELECT * FROM doctor_profiles WHERE verification_status = ?
    // Used by: admin panel to list pending/verified/rejected doctors
    List<DoctorProfile> findByVerificationStatus(VerificationStatus status);

    // Gets all doctors with a specific specialty AND verification status
    // SQL: SELECT * FROM doctor_profiles WHERE specialty = ? AND verification_status = ?
    // FIX: previously getDoctorsBySpecialty showed PENDING/REJECTED doctors too
    List<DoctorProfile> findBySpecialtyAndVerificationStatus(
        String specialty,
        VerificationStatus status
    );

    // Counts doctors with a specific verification status
    // SQL: SELECT COUNT(*) FROM doctor_profiles WHERE verification_status = ?
    // Used by admin stats endpoint — more efficient than findAll().size()
    long countByVerificationStatus(VerificationStatus status);
}
