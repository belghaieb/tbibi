package com.aziz.tbibi.tbibi_backend.repositories;

import com.aziz.tbibi.tbibi_backend.entities.DoctorAvailability;
import com.aziz.tbibi.tbibi_backend.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.DayOfWeek;
import java.util.List;
import java.util.Optional;

@Repository
public interface DoctorAvailabilityRepository extends JpaRepository<DoctorAvailability, Long> {

    List<DoctorAvailability> findByDoctor(User doctor);

    Optional<DoctorAvailability> findByDoctorAndDayOfWeek(User doctor, DayOfWeek day);

    void deleteByDoctor(User doctor);
}
