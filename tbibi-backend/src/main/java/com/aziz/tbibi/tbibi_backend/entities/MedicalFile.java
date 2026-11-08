package com.aziz.tbibi.tbibi_backend.entities;

import com.aziz.tbibi.tbibi_backend.enums.FileCategory;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "medical_files")
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class MedicalFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "patient_id", nullable = false)
    // @ManyToOne = one patient can have MANY medical files
    // @JoinColumn = creates column "patient_id" pointing to users table
    private User patient;

    @ManyToOne
    @JoinColumn(name = "uploaded_by_user_id")
    // the person who uploaded the file
    // can be the patient themselves or a doctor
    // nullable = allowed (no @Column nullable=false)
    private User uploadedBy;

    @Column(nullable = false)
    private String fileName;
    // example: "blood_test_january.pdf"

    @Column(nullable = false)
    private String contentType;
    // example: "application/pdf" or "image/jpeg"
    // tells the browser how to open the file

    @Column(nullable = false)
    private String storageKey;
    // the PATH where the file is saved on disk
    // example: "uploads/medical-files/patient_1/blood_test.pdf"
    // we NEVER store the file itself in MySQL, only the path

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private FileCategory category = FileCategory.OTHER;
    // REPORT, PRESCRIPTION, IMAGING, or OTHER

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    // runs automatically BEFORE saving to MySQL
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}