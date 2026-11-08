package com.aziz.tbibi.tbibi_backend.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class AppointmentRequest {
    private Long patientId;
    private Long doctorId;
    private LocalDateTime scheduledAt;
    private String reason;
}
