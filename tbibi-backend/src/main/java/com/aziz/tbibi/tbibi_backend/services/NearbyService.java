package com.aziz.tbibi.tbibi_backend.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
// JsonNode    = represents a JSON object in Java
// ObjectMapper = converts JSON text into Java objects
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
// RestTemplate = Spring's tool for calling external HTTP APIs

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

// @Slf4j = Lombok generates a "log" variable for us
// Use: log.info(...), log.error(...)
@Slf4j
@Service
@RequiredArgsConstructor
public class NearbyService {

    // API key for healthsites.io — reads from application.properties
    // healthsites.io is a free, open database of health facilities worldwide
    // built on OpenStreetMap data, with a dedicated REST API
    @Value("${app.healthsites.api-key}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();
    // RestTemplate = our HTTP client to call the healthsites.io API

    private final ObjectMapper objectMapper = new ObjectMapper();
    // ObjectMapper = parses the JSON response into Java objects

    // Base URL of the healthsites.io facilities endpoint
    private static final String BASE_URL =
            "https://healthsites.io/api/v3/facilities/";

    public List<Map<String, Object>> findNearbyMedical(
            double latitude,
            double longitude,
            int radius) {
        // finds nearby medical services around a GPS location
        // latitude  = vertical position (e.g. 36.8065 for Tunis)
        // longitude = horizontal position (e.g. 10.1815 for Tunis)
        // radius    = search distance in meters (default 3000)

        List<Map<String, Object>> results = new ArrayList<>();

        try {
            // Step 1: convert center point + radius → bounding box
            // healthsites.io uses "extent" = minLng,minLat,maxLng,maxLat
            // 1 degree of latitude ≈ 111,320 meters (constant)
            // 1 degree of longitude ≈ 111,320 * cos(lat) meters (varies by latitude)
            double latDelta = radius / 111320.0;
            double lngDelta = radius / (111320.0 * Math.cos(Math.toRadians(latitude)));

            double minLat = latitude  - latDelta;
            double maxLat = latitude  + latDelta;
            double minLng = longitude - lngDelta;
            double maxLng = longitude + lngDelta;

            // Step 2: build the API URL
            // api-key  = our authentication token
            // extent   = bounding box (minLng,minLat,maxLng,maxLat)
            // output   = json (we want JSON not XML or GeoJSON)
            // page     = 1 (first page of results)
            String url = BASE_URL
                    + "?api-key="  + apiKey
                    + "&extent="   + minLng + "," + minLat + "," + maxLng + "," + maxLat
                    + "&output=json"
                    + "&page=1";

            // Step 3: call the API and get raw JSON string
            String response = restTemplate.getForObject(url, String.class);

            // Step 4: parse the JSON array of facilities
            JsonNode facilities = objectMapper.readTree(response);

            // Step 5: loop through each facility and extract data
            for (JsonNode facility : facilities) {
                JsonNode attributes = facility.path("attributes");
                // attributes = the details of the facility (name, type, address)

                JsonNode coordinates = facility.path("centroid").path("coordinates");
                // centroid.coordinates = [longitude, latitude] (GeoJSON standard — lon first!)

                if (coordinates.isMissingNode() || coordinates.size() < 2) {
                    continue;
                    // skip facilities with no location data
                }

                double facLng = coordinates.get(0).asDouble();
                double facLat = coordinates.get(1).asDouble();
                // GeoJSON: index 0 = longitude, index 1 = latitude

                Map<String, Object> place = new HashMap<>();
                place.put("name",     attributes.path("name").asText("Unknown"));
                place.put("type",     determineType(attributes));
                place.put("lat",      facLat);
                place.put("lon",      facLng);
                place.put("street",   attributes.path("addr_street").asText(""));
                place.put("city",     attributes.path("addr_city").asText(""));
                place.put("distance", Math.round(
                        calculateDistance(latitude, longitude, facLat, facLng)));
                // distance = straight-line distance in meters from the user to this place

                results.add(place);
            }

        } catch (Exception e) {
            log.error("Erreur Healthsites API (lat={}, lng={}, radius={}): {}",
                    latitude, longitude, radius, e.getMessage());
            // If the API call fails, we return an empty list — no crash
        }

        return results;
    }

    private String determineType(JsonNode attributes) {
        // determine the human-readable type from amenity or healthcare fields
        // healthsites.io provides both — we check amenity first, then healthcare

        String amenity = attributes.path("amenity").asText("");
        if (!amenity.isEmpty()) {
            switch (amenity) {
                case "pharmacy":  return "Pharmacie";
                case "hospital":  return "Hôpital";
                case "clinic":    return "Clinique";
                case "doctors":   return "Cabinet médical";
                case "dentist":   return "Dentiste";
            }
        }

        String healthcare = attributes.path("healthcare").asText("");
        if (!healthcare.isEmpty()) {
            switch (healthcare) {
                case "pharmacy":  return "Pharmacie";
                case "hospital":  return "Hôpital";
                case "clinic":    return "Clinique";
                case "doctor":    return "Cabinet médical";
                case "dentist":   return "Dentiste";
            }
        }

        return "Service médical";
    }

    private double calculateDistance(
            double lat1, double lon1,
            double lat2, double lon2) {
        // Haversine formula — calculates straight-line distance in meters
        // between two GPS coordinates on Earth's surface
        final int EARTH_RADIUS = 6371000; // meters

        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);

        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return EARTH_RADIUS * c;
    }
}
