package com.aziz.tbibi.tbibi_backend.dto;

import com.aziz.tbibi.tbibi_backend.enums.FileCategory;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class MedicalFileResponse {

    private Long id;
    // frontend uses this to call
    // GET /api/patients/me/medical-files/{id}/download

    private String fileName;
    // example: "blood_test_january.pdf"
    // shown in the file history list

    private String contentType;
    // example: "application/pdf" or "image/jpeg"
    // frontend uses this to know how to open the file

    private FileCategory category;
    // REPORT, PRESCRIPTION, IMAGING or OTHER
    // shown as a label next to the file name

    private LocalDateTime createdAt;
    // the date the file was uploaded
    // shown as "01/12/2025" in the history list
}