package com.aziz.tbibi.tbibi_backend.controllers;

import com.aziz.tbibi.tbibi_backend.dto.MedicalFileResponse;
import com.aziz.tbibi.tbibi_backend.enums.FileCategory;
import com.aziz.tbibi.tbibi_backend.services.MedicalFileService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
// HttpHeaders = lets us add extra information to our response
// example: tell the browser what type of file we are sending
import org.springframework.http.MediaType;
// MediaType = represents the type of content
// example: MediaType.APPLICATION_PDF = "application/pdf"
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@RestController
@RequestMapping("/api/patients")
// all endpoints start with /api/patients
@RequiredArgsConstructor
public class MedicalFileController {

    private final MedicalFileService medicalFileService;

    @GetMapping("/{patientId}/medical-files")
    // handles GET /api/patients/1/medical-files
    // returns the list of files for the history section
    public ResponseEntity<List<MedicalFileResponse>> getFiles(
            @PathVariable Long patientId) {
        // @PathVariable = reads patientId from the URL

        return ResponseEntity.ok(
                medicalFileService.getPatientFiles(patientId));
    }

    @PostMapping("/{patientId}/medical-files")
    // handles POST /api/patients/1/medical-files
    // called when patient OR doctor uploads a file to the patient's record
    public ResponseEntity<MedicalFileResponse> uploadFile(
            @PathVariable Long patientId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "category", defaultValue = "OTHER") FileCategory category,
            @RequestParam(value = "uploadedById", required = false) Long uploadedById)
            throws IOException {

        MedicalFileResponse response =
                medicalFileService.uploadFile(patientId, file, category, uploadedById);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{patientId}/medical-files/{fileId}/download")
    // handles GET /api/patients/1/medical-files/3/download
    // called when patient clicks the eye icon to view a file
    public ResponseEntity<Resource> downloadFile(
            @PathVariable Long patientId,
            @PathVariable Long fileId) throws IOException {

        // Step 1: get the file path from service
        Path filePath = medicalFileService.getFilePath(fileId, patientId);

        if (!Files.exists(filePath)) {
            return ResponseEntity.notFound().build();
        }

        // Step 2: read into byte[] so the file handle is released immediately.
        // Using UrlResource keeps the handle open on Windows until GC,
        // which prevents deleting the file while the iframe is open.
        byte[] fileBytes = Files.readAllBytes(filePath);
        Resource resource = new org.springframework.core.io.ByteArrayResource(fileBytes);

        // Step 3: detect content type from the path
        String contentType;
        try {
            contentType = Files.probeContentType(filePath);
            if (contentType == null) contentType = "application/octet-stream";
        } catch (Exception ignored) {
            contentType = "application/octet-stream";
        }

        String fileName = filePath.getFileName().toString();

        // Step 4: send the file to the frontend
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + fileName + "\"")
                .body(resource);
    }

    @DeleteMapping("/{patientId}/medical-files/{fileId}")
    // handles DELETE /api/patients/1/medical-files/3
    // called when patient wants to remove a file
    public ResponseEntity<String> deleteFile(
            @PathVariable Long patientId,
            @PathVariable Long fileId) throws IOException {

        medicalFileService.deleteFile(fileId, patientId);

        return ResponseEntity.ok(
                "File deleted successfully");
    }
}