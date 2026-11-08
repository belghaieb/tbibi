package com.aziz.tbibi.tbibi_backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AvailabilityResponse {
    private Long   id;
    private String dayOfWeek;
    private String startTime;
    private String endTime;
}
