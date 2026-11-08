package com.aziz.tbibi.tbibi_backend.dto;

import com.aziz.tbibi.tbibi_backend.enums.VerificationStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class DoctorResponse {

    private Long id;
    // doctor's user ID
    // frontend uses this to call GET /api/doctors/{id}

    private String firstName;
    private String lastName;

    private String specialty;
    // example: "Cardiologue", "Gynécologue", "Pédiatre"
    // shown under the doctor's name in the left panel

    private Integer experienceYears;
    // example: 11
    // shown as "11 Ans Expérience" in the right panel

    private String bio;
    // the long description text shown in the right panel
    // example: "Dr. Ichrak is a gynecologist who specializes in..."

    private String avatarUrl;
    // path to the doctor's profile picture
    // shown as the circular photo in both panels

    private VerificationStatus verificationStatus;
    // only VERIFIED doctors are shown to patients
    // PENDING and REJECTED doctors are hidden

    private Boolean isOnline;
    // true  = shows green "En Ligne" badge in the dashboard
    // false = shows grey "Hors Ligne" badge
}