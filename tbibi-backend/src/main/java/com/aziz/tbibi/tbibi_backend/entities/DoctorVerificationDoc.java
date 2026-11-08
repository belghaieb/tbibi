package com.aziz.tbibi.tbibi_backend.entities;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "doctor_verification_docs")
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class DoctorVerificationDoc {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "doctor_user_id", nullable = false)
    // @ManyToOne = one doctor can have MANY verification documents
    // example: ID card + diploma + license = 3 documents for 1 doctor
    private User doctor;

    @Column(nullable = false)
    private String docType;
    // example: "ID_CARD", "DIPLOMA", "LICENSE"
    // these are the 3 documents a doctor must upload during signup

    @Column(nullable = false)
    private String storageKey;
    // the PATH where the document is saved on disk
    // example: "uploads/doctor-docs/doctor_1/diploma.pdf"
    // same logic as MedicalFile - we only store the path in MySQL

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    // runs automatically BEFORE saving to MySQL
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}