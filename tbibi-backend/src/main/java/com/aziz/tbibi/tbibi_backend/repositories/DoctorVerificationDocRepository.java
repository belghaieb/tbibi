package com.aziz.tbibi.tbibi_backend.repositories;

import com.aziz.tbibi.tbibi_backend.entities.DoctorVerificationDoc;
import com.aziz.tbibi.tbibi_backend.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DoctorVerificationDocRepository
        extends JpaRepository<DoctorVerificationDoc, Long> {

    List<DoctorVerificationDoc> findByDoctor(User doctor);
    // generates: SELECT * FROM doctor_verification_docs
    //            WHERE doctor_user_id = ?
    // used to get ALL documents uploaded by a specific doctor
    // example: get all 3 documents (ID card, diploma, license)
    // that a doctor uploaded during registration

}