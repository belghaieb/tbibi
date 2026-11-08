package com.aziz.tbibi.tbibi_backend.services;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// Tracks which users are currently online using a ping-based approach.
// The frontend calls POST /api/presence/ping every 30 seconds.
// A user is considered online if their last ping was within 2 minutes.
// In-memory only — resets on server restart (fine for demo purposes).
@Service
public class UserPresenceService {

    // userId → time of last ping
    private final Map<Long, Instant> lastSeen = new ConcurrentHashMap<>();

    // A user is "online" if they pinged within the last 2 minutes
    private static final Duration ONLINE_THRESHOLD = Duration.ofMinutes(2);

    public void ping(Long userId) {
        lastSeen.put(userId, Instant.now());
    }

    public boolean isOnline(Long userId) {
        Instant last = lastSeen.get(userId);
        if (last == null) return false;
        return Duration.between(last, Instant.now()).compareTo(ONLINE_THRESHOLD) < 0;
    }
}
