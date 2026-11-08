package com.aziz.tbibi.tbibi_backend.services;

import com.aziz.tbibi.tbibi_backend.dto.MedicalFileResponse;
import com.aziz.tbibi.tbibi_backend.entities.MedicalFile;
import com.aziz.tbibi.tbibi_backend.entities.User;
import com.aziz.tbibi.tbibi_backend.enums.FileCategory;
import com.aziz.tbibi.tbibi_backend.repositories.MedicalFileRepository;
import com.aziz.tbibi.tbibi_backend.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
// MultipartFile = Spring's way of receiving an uploaded file
// from the frontend (PDF, image, etc.)

import java.io.IOException;
// IOException = error that happens when reading or writing files
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
// Files, Path, Paths = Java classes for working with files on disk
// StandardCopyOption = options for copying files
import java.util.List;
import java.util.UUID;
// UUID = generates a random unique name for each file
// example: "a3f8c2d1-4b5e-4f6a-8c9d-1e2f3a4b5c6d.pdf"
// prevents overwriting files that have the same name
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MedicalFileService {

    private final MedicalFileRepository medicalFileRepository;
    private final UserRepository userRepository;

    private final String UPLOAD_DIR = "uploads/medical-files/";
    // UPLOAD_DIR = the folder on disk where we save medical files
    // this folder will be created automatically if it doesn't exist

    public MedicalFileResponse uploadFile(
            Long patientId,
            MultipartFile file,
            FileCategory category) throws IOException {
        return uploadFile(patientId, file, category, null);
    }

    public MedicalFileResponse uploadFile(
            Long patientId,
            MultipartFile file,
            FileCategory category,
            Long uploadedById) throws IOException {
        // uploads a medical file for a patient

        // Step 1: find the patient in MySQL
        User patient = userRepository.findById(patientId)
                .orElseThrow(() ->
                        new RuntimeException("Patient not found"));

        // Step 2: create the folder if it doesn't exist
        Path uploadPath = Paths.get(
                UPLOAD_DIR + "patient_" + patientId);
        // example path: uploads/medical-files/patient_1/
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
            // createDirectories() = creates all folders
            // in the path that don't exist yet
        }

        // Step 3: generate a unique file name
        String originalFileName = file.getOriginalFilename();
        // getOriginalFilename() = gets the original name
        // of the file sent by the frontend
        String uniqueFileName = UUID.randomUUID()
                .toString() + "_" + originalFileName;
        // UUID.randomUUID() = generates a random unique ID
        // example: "a3f8c2d1_blood_test.pdf"
        // this prevents two files with same name overwriting each other

        // Step 4: save the file on disk
        Path filePath = uploadPath.resolve(uniqueFileName);
        // resolve() = combines the folder path and file name
        // example: uploads/medical-files/patient_1/a3f8c2d1_blood_test.pdf
        Files.copy(
                file.getInputStream(),
                filePath,
                StandardCopyOption.REPLACE_EXISTING);
        // copy() = writes the file bytes to disk
        // getInputStream() = reads the uploaded file bytes
        // REPLACE_EXISTING = overwrite if somehow same name exists

        // Step 5: save file info in MySQL
        User uploader = (uploadedById != null)
                ? userRepository.findById(uploadedById).orElse(patient)
                : patient;

        MedicalFile medicalFile = MedicalFile.builder()
                .patient(patient)
                .uploadedBy(uploader)
                .fileName(originalFileName)
                .contentType(file.getContentType())
                .storageKey(filePath.toString())
                // storageKey = the path on disk where file is saved
                .category(category)
                .build();

        MedicalFile saved =
                medicalFileRepository.save(medicalFile);

        // Step 6: return the response
        return mapToResponse(saved);
    }

    public List<MedicalFileResponse> getPatientFiles(
            Long patientId) {
        // returns ALL medical files of a patient
        // powers the "Historique des Fichiers" in the dashboard

        User patient = userRepository.findById(patientId)
                .orElseThrow(() ->
                        new RuntimeException("Patient not found"));

        return medicalFileRepository
                .findByPatient(patient)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public Path getFilePath(Long fileId, Long patientId) {
        // returns the path of a file so the controller
        // can send it back to the frontend for viewing

        MedicalFile medicalFile = medicalFileRepository
                .findById(fileId)
                .orElseThrow(() ->
                        new RuntimeException("File not found"));

        // security check: file must belong to the given patient
        // (doctors pass the real patient ID in the URL, so this still holds)
        if (!medicalFile.getPatient().getId().equals(patientId)) {
            throw new RuntimeException("Access denied - file does not belong to this patient");
        }

        return Paths.get(medicalFile.getStorageKey());
    }

    public void deleteFile(Long fileId, Long patientId)
            throws IOException {
        // deletes a medical file from disk and MySQL

        MedicalFile medicalFile = medicalFileRepository
                .findById(fileId)
                .orElseThrow(() ->
                        new RuntimeException("File not found"));

        // security check
        if (!medicalFile.getPatient()
                .getId().equals(patientId)) {
            throw new RuntimeException(
                    "Access denied - this file is not yours");
        }

        // Step 1: delete from disk
        Path filePath = Paths.get(
                medicalFile.getStorageKey());
        Files.deleteIfExists(filePath);
        // deleteIfExists() = deletes the file if it exists
        // does not throw error if file is already gone

        // Step 2: delete from MySQL
        medicalFileRepository.delete(medicalFile);
    }

    private MedicalFileResponse mapToResponse(
            MedicalFile file) {
        // converts MedicalFile entity to MedicalFileResponse DTO

        return MedicalFileResponse.builder()
                .id(file.getId())
                .fileName(file.getFileName())
                .contentType(file.getContentType())
                .category(file.getCategory())
                .createdAt(file.getCreatedAt())
                .build();
    }
}