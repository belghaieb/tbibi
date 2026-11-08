package com.aziz.tbibi.tbibi_backend.repositories;

import com.aziz.tbibi.tbibi_backend.entities.Appointment;
import com.aziz.tbibi.tbibi_backend.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, Long> {

    List<Appointment> findByPatientOrderByScheduledAtDesc(User patient);

    List<Appointment> findByDoctorOrderByScheduledAtDesc(User doctor);

    // Returns all booked time slots for a doctor (PENDING or CONFIRMED only).
    // Used by the patient calendar to show which slots are already taken.
    @Query("SELECT a.scheduledAt FROM Appointment a WHERE a.doctor = :doctor " +
           "AND a.status IN (com.aziz.tbibi.tbibi_backend.enums.AppointmentStatus.PENDING, " +
           "com.aziz.tbibi.tbibi_backend.enums.AppointmentStatus.CONFIRMED)")
    List<LocalDateTime> findBookedSlotsByDoctor(@Param("doctor") User doctor);
}
