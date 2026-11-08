package com.aziz.tbibi.tbibi_backend.repositories;

import com.aziz.tbibi.tbibi_backend.entities.MedicalFile;
import com.aziz.tbibi.tbibi_backend.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MedicalFileRepository extends JpaRepository<MedicalFile, Long> {

    List<MedicalFile> findByPatient(User patient);
    // generates: SELECT * FROM medical_files WHERE patient_id = ?
    // used to get ALL files of a specific patient
    // this powers the "Historique des Fichiers" section in the dashboard
}