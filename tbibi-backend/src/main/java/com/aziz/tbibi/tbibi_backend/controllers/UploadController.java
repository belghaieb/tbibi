package com.aziz.tbibi.tbibi_backend.controllers;

import com.aziz.tbibi.tbibi_backend.entities.DoctorProfile;
import com.aziz.tbibi.tbibi_backend.entities.DoctorVerificationDoc;
import com.aziz.tbibi.tbibi_backend.entities.MedicalFile;
import com.aziz.tbibi.tbibi_backend.entities.User;
import com.aziz.tbibi.tbibi_backend.enums.FileCategory;
import com.aziz.tbibi.tbibi_backend.enums.Role;
import com.aziz.tbibi.tbibi_backend.repositories.DoctorProfileRepository;
import com.aziz.tbibi.tbibi_backend.repositories.DoctorVerificationDocRepository;
import com.aziz.tbibi.tbibi_backend.repositories.MedicalFileRepository;
import com.aziz.tbibi.tbibi_backend.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/uploads")
@RequiredArgsConstructor
public class UploadController {

    private final UserRepository userRepository;
    private final DoctorVerificationDocRepository doctorVerificationDocRepository;
    private final MedicalFileRepository medicalFileRepository;
    private final DoctorProfileRepository doctorProfileRepository;

    private static final String UPLOAD_BASE = "uploads/";

    // Reads the server base URL from application.properties
    // Default = http://localhost:8084 if the property is not set
    // Change app.server.base-url in application.properties when deploying
    @org.springframework.beans.factory.annotation.Value("${app.server.base-url:http://localhost:8084}")
    private String serverBaseUrl;

    // POST /api/uploads/doctor-docs
    // Called after doctor registration to upload ID, diploma, license
    @PostMapping("/doctor-docs")
    public ResponseEntity<Map<String, String>> uploadDoctorDocs(
            @RequestParam("doctorId") Long doctorId,
            @RequestParam(value = "idCard",  required = false) MultipartFile idCard,
            @RequestParam(value = "diploma", required = false) MultipartFile diploma,
            @RequestParam(value = "license", required = false) MultipartFile license) throws IOException {

        User doctor = userRepository.findById(doctorId)
                .orElseThrow(() -> new RuntimeException("Doctor not found"));

        Path dir = Paths.get(UPLOAD_BASE + "doctor-docs/user_" + doctorId);
        Files.createDirectories(dir);

        saveDoc(idCard,   "ID_CARD",  doctor, dir);
        saveDoc(diploma,  "DIPLOMA",  doctor, dir);
        saveDoc(license,  "LICENSE",  doctor, dir);

        return ResponseEntity.ok(Map.of("message", "Documents uploaded successfully"));
    }

    // POST /api/uploads/patient-medical-files
    // Called after patient registration to upload optional initial medical files
    @PostMapping("/patient-medical-files")
    public ResponseEntity<Map<String, String>> uploadPatientFiles(
            @RequestParam("patientId") Long patientId,
            @RequestParam("files") List<MultipartFile> files) throws IOException {

        User patient = userRepository.findById(patientId)
                .orElseThrow(() -> new RuntimeException("Patient not found"));

        Path dir = Paths.get(UPLOAD_BASE + "medical-files/patient_" + patientId);
        Files.createDirectories(dir);

        for (MultipartFile file : files) {
            if (file.isEmpty()) continue;

            String uniqueName = UUID.randomUUID() + "_" + file.getOriginalFilename();
            Path dest = dir.resolve(uniqueName);
            Files.copy(file.getInputStream(), dest, StandardCopyOption.REPLACE_EXISTING);

            medicalFileRepository.save(
                MedicalFile.builder()
                    .patient(patient)
                    .uploadedBy(patient)
                    .fileName(file.getOriginalFilename())
                    .contentType(file.getContentType())
                    .storageKey(dest.toString())
                    .category(FileCategory.OTHER)
                    .build()
            );
        }

        return ResponseEntity.ok(Map.of("message", "Files uploaded successfully"));
    }

    // POST /api/uploads/chat-image
    // Called when a user sends a photo in chat — returns { imageUrl }
    @PostMapping("/chat-image")
    public ResponseEntity<Map<String, String>> uploadChatImage(
            @RequestParam("image") MultipartFile image) throws IOException {

        if (image == null || image.isEmpty()) {
            throw new RuntimeException("No image provided");
        }

        Path dir = Paths.get(UPLOAD_BASE + "chat-images");
        Files.createDirectories(dir);

        String ext = "";
        String original = image.getOriginalFilename();
        if (original != null && original.contains(".")) {
            ext = original.substring(original.lastIndexOf("."));
        }
        String fileName = UUID.randomUUID() + ext;
        Path dest = dir.resolve(fileName);
        Files.copy(image.getInputStream(), dest, StandardCopyOption.REPLACE_EXISTING);

        String url = serverBaseUrl + "/uploads/chat-images/" + fileName;
        return ResponseEntity.ok(Map.of("imageUrl", url));
    }

    // POST /api/uploads/avatar?userId=X
    // Called at signup and from account settings to upload/change profile photo
    @PostMapping("/avatar")
    public ResponseEntity<Map<String, String>> uploadAvatar(
            @RequestParam("userId") Long userId,
            @RequestParam("avatar") MultipartFile avatar) throws IOException {

        if (avatar == null || avatar.isEmpty()) {
            throw new RuntimeException("No file provided");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Path dir = Paths.get(UPLOAD_BASE + "avatars");
        Files.createDirectories(dir);

        String ext = "";
        String original = avatar.getOriginalFilename();
        if (original != null && original.contains(".")) {
            ext = original.substring(original.lastIndexOf("."));
        }
        String fileName = "user_" + userId + ext;
        Path dest = dir.resolve(fileName);
        Files.copy(avatar.getInputStream(), dest, StandardCopyOption.REPLACE_EXISTING);

        // FIX: was hardcoded "http://localhost:8084" — breaks when deployed
        // Now reads from application.properties: app.server.base-url
        String url = serverBaseUrl + "/uploads/avatars/" + fileName;

        // save on User entity (works for both PATIENT and DOCTOR)
        user.setAvatarUrl(url);
        userRepository.save(user);

        // if doctor also update DoctorProfile.avatarUrl
        if (user.getRole() == Role.DOCTOR) {
            doctorProfileRepository.findByUser(user).ifPresent(profile -> {
                profile.setAvatarUrl(url);
                doctorProfileRepository.save(profile);
            });
        }

        return ResponseEntity.ok(Map.of("avatarUrl", url));
    }

    private void saveDoc(MultipartFile file, String docType, User doctor, Path dir) throws IOException {
        if (file == null || file.isEmpty()) return;

        String uniqueName = UUID.randomUUID() + "_" + file.getOriginalFilename();
        Path dest = dir.resolve(uniqueName);
        Files.copy(file.getInputStream(), dest, StandardCopyOption.REPLACE_EXISTING);

        doctorVerificationDocRepository.save(
            DoctorVerificationDoc.builder()
                .doctor(doctor)
                .docType(docType)
                .storageKey(dest.toString())
                .build()
        );
    }
}
