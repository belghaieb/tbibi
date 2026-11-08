package com.aziz.tbibi.tbibi_backend.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class AppointmentResponse {
    private Long id;
    private Long patientId;
    private String patientName;
    private String patientAvatarUrl;
    private Long doctorId;
    private String doctorName;
    private String specialty;
    private LocalDateTime scheduledAt;
    private String reason;
    private String status;
    private LocalDateTime createdAt;
}
