package com.aziz.tbibi.tbibi_backend.controllers;

import com.aziz.tbibi.tbibi_backend.services.NearbyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/nearby-medical")
// all endpoints start with /api/nearby-medical
@RequiredArgsConstructor
public class NearbyController {

    private final NearbyService nearbyService;

    @GetMapping
    // handles GET /api/nearby-medical?lat=36.8&lng=10.1&radius=3000
    // frontend calls this when patient clicks "Me localiser"
    public ResponseEntity<List<Map<String, Object>>>
    findNearbyMedical(
            @RequestParam double lat,
            // lat = latitude sent by the browser
            // example: 36.8065 (Tunis latitude)
            @RequestParam double lng,
            // lng = longitude sent by the browser
            // example: 10.1815 (Tunis longitude)
            @RequestParam(
                    defaultValue = "3000") int radius) {
        // radius = search distance in meters
        // defaultValue = "3000" means if frontend
        // does not send radius we use 3000 meters

        List<Map<String, Object>> results =
                nearbyService.findNearbyMedical(lat, lng, radius);

        return ResponseEntity.ok(results);
    }
}