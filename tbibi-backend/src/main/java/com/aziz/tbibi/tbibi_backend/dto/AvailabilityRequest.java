package com.aziz.tbibi.tbibi_backend.dto;

import lombok.Data;

import java.util.List;

/**
 * Body for PUT /api/doctors/{doctorId}/availability
 * Replaces the doctor's full availability schedule.
 *
 * Example:
 * {
 *   "slots": [
 *     { "dayOfWeek": "MONDAY",    "startTime": "08:00", "endTime": "17:00" },
 *     { "dayOfWeek": "WEDNESDAY", "startTime": "09:00", "endTime": "13:00" }
 *   ]
 * }
 */
@Data
public class AvailabilityRequest {
    private List<SlotDto> slots;

    @Data
    public static class SlotDto {
        private String dayOfWeek;  // "MONDAY", "TUESDAY", etc.
        private String startTime;  // "HH:mm"
        private String endTime;    // "HH:mm"
    }
}
