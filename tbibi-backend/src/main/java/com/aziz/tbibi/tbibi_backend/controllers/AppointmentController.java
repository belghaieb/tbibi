package com.aziz.tbibi.tbibi_backend.controllers;

import com.aziz.tbibi.tbibi_backend.dto.AppointmentRequest;
import com.aziz.tbibi.tbibi_backend.dto.AppointmentResponse;
import com.aziz.tbibi.tbibi_backend.entities.Appointment;
import com.aziz.tbibi.tbibi_backend.entities.User;
import com.aziz.tbibi.tbibi_backend.enums.AppointmentStatus;
import com.aziz.tbibi.tbibi_backend.entities.DoctorAvailability;
import com.aziz.tbibi.tbibi_backend.repositories.AppointmentRepository;
import com.aziz.tbibi.tbibi_backend.repositories.DoctorAvailabilityRepository;
import com.aziz.tbibi.tbibi_backend.repositories.DoctorProfileRepository;
import com.aziz.tbibi.tbibi_backend.repositories.UserRepository;
import com.aziz.tbibi.tbibi_backend.services.EmailService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/appointments")
@RequiredArgsConstructor
public class AppointmentController {

    private final AppointmentRepository        appointmentRepository;
    private final UserRepository               userRepository;
    private final DoctorProfileRepository      doctorProfileRepository;
    private final DoctorAvailabilityRepository availabilityRepository;
    private final EmailService                 emailService;

    // ─── POST /api/appointments ───────────────────────────────────────────
    // Patient books an appointment with a doctor.
    // Body: { patientId, doctorId, scheduledAt, reason }
    @PostMapping
    public ResponseEntity<AppointmentResponse> book(@RequestBody AppointmentRequest req) {

        if (req.getScheduledAt() == null ||
            req.getScheduledAt().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("La date du rendez-vous doit être dans le futur");
        }

        User patient = userRepository.findById(req.getPatientId())
            .orElseThrow(() -> new RuntimeException("Patient introuvable"));

        User doctor = userRepository.findById(req.getDoctorId())
            .orElseThrow(() -> new RuntimeException("Médecin introuvable"));

        String reason = req.getReason() != null ? req.getReason() : "Consultation";

        Appointment saved = appointmentRepository.save(
            Appointment.builder()
                .patient(patient)
                .doctor(doctor)
                .scheduledAt(req.getScheduledAt())
                .reason(reason)
                .build()
        );

        // Notify patient (confirmation) and doctor (new booking) — async, won't block response
        String specialty = doctorProfileRepository.findByUser(doctor)
            .map(p -> p.getSpecialty()).orElse(null);

        emailService.sendAppointmentBookedToPatient(
            patient.getEmail(),
            patient.getFirstName() + " " + patient.getLastName(),
            doctor.getFirstName() + " " + doctor.getLastName(),
            specialty,
            saved.getScheduledAt(),
            reason
        );
        emailService.sendAppointmentBookedToDoctor(
            doctor.getEmail(),
            doctor.getFirstName() + " " + doctor.getLastName(),
            patient.getFirstName() + " " + patient.getLastName(),
            saved.getScheduledAt(),
            reason
        );

        return ResponseEntity.ok(toResponse(saved));
    }

    // ─── GET /api/appointments/patient/{patientId} ────────────────────────
    @GetMapping("/patient/{patientId}")
    public ResponseEntity<List<AppointmentResponse>> getByPatient(@PathVariable Long patientId) {
        User patient = userRepository.findById(patientId)
            .orElseThrow(() -> new RuntimeException("Patient introuvable"));

        return ResponseEntity.ok(
            appointmentRepository.findByPatientOrderByScheduledAtDesc(patient)
                .stream().map(this::toResponse).collect(Collectors.toList())
        );
    }

    // ─── GET /api/appointments/doctor/{doctorId} ──────────────────────────
    @GetMapping("/doctor/{doctorId}")
    public ResponseEntity<List<AppointmentResponse>> getByDoctor(@PathVariable Long doctorId) {
        User doctor = userRepository.findById(doctorId)
            .orElseThrow(() -> new RuntimeException("Médecin introuvable"));

        return ResponseEntity.ok(
            appointmentRepository.findByDoctorOrderByScheduledAtDesc(doctor)
                .stream().map(this::toResponse).collect(Collectors.toList())
        );
    }

    // ─── PUT /api/appointments/{id}/status ───────────────────────────────
    // Body: { "status": "CONFIRMED" | "CANCELLED" }
    @PutMapping("/{id}/status")
    public ResponseEntity<AppointmentResponse> updateStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {

        Appointment appt = appointmentRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Rendez-vous introuvable"));

        String statusStr = body.get("status");
        if (statusStr == null) throw new RuntimeException("Le champ 'status' est requis");

        AppointmentStatus newStatus = AppointmentStatus.valueOf(statusStr.toUpperCase());
        appt.setStatus(newStatus);
        appointmentRepository.save(appt);

        User patient = appt.getPatient();
        User doctor  = appt.getDoctor();
        String patientFullName = patient.getFirstName() + " " + patient.getLastName();
        String doctorFullName  = doctor.getFirstName()  + " " + doctor.getLastName();

        // Send email based on new status
        if (newStatus == AppointmentStatus.CONFIRMED) {
            emailService.sendAppointmentConfirmed(
                patient.getEmail(), patientFullName,
                doctorFullName, appt.getScheduledAt()
            );
        } else if (newStatus == AppointmentStatus.CANCELLED) {
            emailService.sendAppointmentCancelled(
                patient.getEmail(), patientFullName,
                doctorFullName, appt.getScheduledAt()
            );
            emailService.sendAppointmentCancelledToDoctor(
                doctor.getEmail(), doctorFullName,
                patientFullName, appt.getScheduledAt()
            );
        }

        return ResponseEntity.ok(toResponse(appt));
    }

    // ─── PUT /api/appointments/{id}/reschedule ────────────────────────────
    // Patient reschedules an appointment.
    // Body: { "scheduledAt": "2026-04-25T10:00:00" }
    @PutMapping("/{id}/reschedule")
    public ResponseEntity<AppointmentResponse> reschedule(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {

        Appointment appt = appointmentRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Rendez-vous introuvable"));

        String newDateStr = body.get("scheduledAt");
        if (newDateStr == null) throw new RuntimeException("Le champ 'scheduledAt' est requis");

        LocalDateTime newDate = LocalDateTime.parse(newDateStr);
        if (newDate.isBefore(LocalDateTime.now())) {
            throw new RuntimeException("La nouvelle date doit être dans le futur");
        }

        LocalDateTime oldDate = appt.getScheduledAt();

        // Reset to PENDING so doctor re-confirms the new slot
        appt.setScheduledAt(newDate);
        appt.setStatus(AppointmentStatus.PENDING);
        appointmentRepository.save(appt);

        User patient = appt.getPatient();
        User doctor  = appt.getDoctor();

        emailService.sendAppointmentRescheduled(
            doctor.getEmail(),
            doctor.getFirstName() + " " + doctor.getLastName(),
            patient.getFirstName() + " " + patient.getLastName(),
            oldDate, newDate
        );

        return ResponseEntity.ok(toResponse(appt));
    }

    // ─── GET /api/appointments/doctor/{doctorId}/slots?date=YYYY-MM-DD ───
    // Returns a list of "taken" time slots for a doctor on a given date.
    // A slot is taken if:
    //   (a) it already has a PENDING/CONFIRMED appointment, OR
    //   (b) it falls outside the doctor's availability window for that day.
    // Frontend uses this to grey-out unavailable slots in the calendar.
    @GetMapping("/doctor/{doctorId}/slots")
    public ResponseEntity<List<String>> getBookedSlots(
            @PathVariable Long doctorId,
            @RequestParam(required = false) String date) {

        User doctor = userRepository.findById(doctorId)
            .orElseThrow(() -> new RuntimeException("Médecin introuvable"));

        // All fixed time slots shown in the frontend calendar
        List<String> ALL_SLOTS = List.of(
            "08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
            "14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30"
        );

        List<String> taken = new ArrayList<>();

        // (a) Already booked slots on this date
        List<String> booked = appointmentRepository
            .findBookedSlotsByDoctor(doctor)
            .stream()
            .filter(dt -> date == null || dt.toLocalDate().toString().equals(date))
            .map(dt -> {
                String t = dt.toLocalTime().toString();
                return t.length() >= 5 ? t.substring(0, 5) : t;
            })
            .collect(Collectors.toList());
        taken.addAll(booked);

        // (b) Slots outside doctor's availability window (only when date is provided)
        if (date != null) {
            LocalDate localDate = LocalDate.parse(date);
            DayOfWeek dow = localDate.getDayOfWeek();

            Optional<DoctorAvailability> avail =
                availabilityRepository.findByDoctorAndDayOfWeek(doctor, dow);

            if (avail.isEmpty()) {
                // No availability configured — show all slots as free (only booked ones are taken)
            } else {
                LocalTime start = avail.get().getStartTime();
                LocalTime end   = avail.get().getEndTime();
                for (String slot : ALL_SLOTS) {
                    LocalTime slotTime = LocalTime.parse(slot);
                    if (slotTime.isBefore(start) || !slotTime.isBefore(end)) {
                        if (!taken.contains(slot)) taken.add(slot);
                    }
                }
            }
        }

        return ResponseEntity.ok(taken);
    }

    // ─── toResponse helper ────────────────────────────────────────────────
    private AppointmentResponse toResponse(Appointment a) {
        String specialty = doctorProfileRepository.findByUser(a.getDoctor())
            .map(p -> p.getSpecialty()).orElse(null);

        return AppointmentResponse.builder()
            .id(a.getId())
            .patientId(a.getPatient().getId())
            .patientName(a.getPatient().getFirstName() + " " + a.getPatient().getLastName())
            .patientAvatarUrl(a.getPatient().getAvatarUrl())
            .doctorId(a.getDoctor().getId())
            .doctorName(a.getDoctor().getFirstName() + " " + a.getDoctor().getLastName())
            .specialty(specialty)
            .scheduledAt(a.getScheduledAt())
            .reason(a.getReason())
            .status(a.getStatus().name())
            .createdAt(a.getCreatedAt())
            .build();
    }
}
