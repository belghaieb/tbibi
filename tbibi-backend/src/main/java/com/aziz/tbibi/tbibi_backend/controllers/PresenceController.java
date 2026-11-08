package com.aziz.tbibi.tbibi_backend.controllers;

import com.aziz.tbibi.tbibi_backend.services.UserPresenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

// Receives heartbeat pings from the frontend every 30 seconds.
// Used to determine which doctors (and users) are currently online.
// Frontend calls: POST /api/presence/ping?userId=5
@RestController
@RequestMapping("/api/presence")
@RequiredArgsConstructor
public class PresenceController {

    private final UserPresenceService presenceService;

    @PostMapping("/ping")
    public ResponseEntity<Void> ping(@RequestParam Long userId) {
        presenceService.ping(userId);
        return ResponseEntity.ok().build();
    }
}
