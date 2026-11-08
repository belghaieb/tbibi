package com.aziz.tbibi.tbibi_backend.entities;

import com.aziz.tbibi.tbibi_backend.enums.VerificationStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "doctor_profiles")
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class DoctorProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false)
    // @OneToOne   = one doctor profile belongs to exactly one user
    // @JoinColumn = creates a column "user_id" in doctor_profiles table
    //               that points to the id in the users table
    private User user;

    @Column(nullable = false)
    private String specialty;
    // example: "Cardiologue", "Gynécologue", "Pédiatre"

    private Integer experienceYears;
    // Integer allows null (doctor might not fill this yet)

    @Column(length = 1000)
    // length = 1000 means this text can be up to 1000 characters
    private String bio;

    private String avatarUrl;
    // stores the path to the doctor's profile picture on disk

    @Enumerated(EnumType.STRING)
    @Builder.Default
    // @Builder.Default = when using builder, this field starts with PENDING
    private VerificationStatus verificationStatus = VerificationStatus.PENDING;
    // every new doctor starts as PENDING until admin verifies them
}