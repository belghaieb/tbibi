package com.aziz.tbibi.tbibi_backend.controllers;

import com.aziz.tbibi.tbibi_backend.dto.AvailabilityRequest;
import com.aziz.tbibi.tbibi_backend.dto.AvailabilityResponse;
import com.aziz.tbibi.tbibi_backend.dto.DoctorResponse;
import com.aziz.tbibi.tbibi_backend.entities.DoctorAvailability;
import com.aziz.tbibi.tbibi_backend.entities.User;
import com.aziz.tbibi.tbibi_backend.repositories.DoctorAvailabilityRepository;
import com.aziz.tbibi.tbibi_backend.repositories.UserRepository;
import com.aziz.tbibi.tbibi_backend.services.DoctorService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/doctors")
@RequiredArgsConstructor
public class DoctorController {

    private final DoctorService                 doctorService;
    private final DoctorAvailabilityRepository  availabilityRepository;
    private final UserRepository                userRepository;

    // ─── GET /api/doctors ─────────────────────────────────────────────────
    @GetMapping
    public ResponseEntity<List<DoctorResponse>> getAllDoctors(
            @RequestParam(required = false) String specialty) {
        if (specialty != null && !specialty.isEmpty()) {
            return ResponseEntity.ok(doctorService.getDoctorsBySpecialty(specialty));
        }
        return ResponseEntity.ok(doctorService.getAllDoctors());
    }

    // ─── GET /api/doctors/{id} ────────────────────────────────────────────
    @GetMapping("/{id}")
    public ResponseEntity<DoctorResponse> getDoctorById(@PathVariable Long id) {
        return ResponseEntity.ok(doctorService.getDoctorById(id));
    }

    // ─── GET /api/doctors/{doctorId}/availability ─────────────────────────
    // Returns the doctor's weekly availability schedule.
    // Public — patients need this to know which days/times the doctor works.
    @GetMapping("/{doctorId}/availability")
    public ResponseEntity<List<AvailabilityResponse>> getAvailability(
            @PathVariable Long doctorId) {

        User doctor = userRepository.findById(doctorId)
            .orElseThrow(() -> new RuntimeException("Médecin introuvable"));

        List<AvailabilityResponse> result = availabilityRepository.findByDoctor(doctor)
            .stream()
            .map(this::toResponse)
            .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ─── PUT /api/doctors/{doctorId}/availability ─────────────────────────
    // Doctor sets (or replaces) their full weekly availability.
    // Sending an empty slots array clears the schedule entirely.
    @PutMapping("/{doctorId}/availability")
    @Transactional
    public ResponseEntity<List<AvailabilityResponse>> setAvailability(
            @PathVariable Long doctorId,
            @RequestBody AvailabilityRequest req) {

        User doctor = userRepository.findById(doctorId)
            .orElseThrow(() -> new RuntimeException("Médecin introuvable"));

        // Replace all existing rows for this doctor
        availabilityRepository.deleteByDoctor(doctor);

        List<DoctorAvailability> saved = req.getSlots().stream()
            .map(slot -> availabilityRepository.save(
                DoctorAvailability.builder()
                    .doctor(doctor)
                    .dayOfWeek(DayOfWeek.valueOf(slot.getDayOfWeek().toUpperCase()))
                    .startTime(LocalTime.parse(slot.getStartTime()))
                    .endTime(LocalTime.parse(slot.getEndTime()))
                    .build()
            ))
            .collect(Collectors.toList());

        return ResponseEntity.ok(
            saved.stream().map(this::toResponse).collect(Collectors.toList())
        );
    }

    // ─── helper ───────────────────────────────────────────────────────────
    private AvailabilityResponse toResponse(DoctorAvailability a) {
        return AvailabilityResponse.builder()
            .id(a.getId())
            .dayOfWeek(a.getDayOfWeek().name())
            .startTime(a.getStartTime().toString())
            .endTime(a.getEndTime().toString())
            .build();
    }
}