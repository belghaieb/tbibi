package com.aziz.tbibi.tbibi_backend.controllers;

import com.aziz.tbibi.tbibi_backend.dto.ChatMessagePayload;
import com.aziz.tbibi.tbibi_backend.dto.ChatMessageResponse;
import com.aziz.tbibi.tbibi_backend.entities.ChatMessage;
import com.aziz.tbibi.tbibi_backend.entities.User;
import com.aziz.tbibi.tbibi_backend.entities.UserSubscription;
import com.aziz.tbibi.tbibi_backend.enums.Role;
import com.aziz.tbibi.tbibi_backend.repositories.ChatMessageRepository;
import com.aziz.tbibi.tbibi_backend.repositories.UserRepository;
import com.aziz.tbibi.tbibi_backend.repositories.UserSubscriptionRepository;
import com.aziz.tbibi.tbibi_backend.services.UserPresenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class ChatController {

    private final ChatMessageRepository    chatMessageRepository;
    private final UserRepository           userRepository;
    private final UserSubscriptionRepository userSubscriptionRepository;
    private final SimpMessagingTemplate    messagingTemplate;
    private final UserPresenceService      presenceService;

    // WebSocket endpoint — frontend sends to /app/chat
    @MessageMapping("/chat")
    public void handleChat(ChatMessagePayload payload) {
        User sender = userRepository.findById(payload.getSenderId())
                .orElseThrow(() -> new RuntimeException("Sender not found"));
        User receiver = userRepository.findById(payload.getReceiverId())
                .orElseThrow(() -> new RuntimeException("Receiver not found"));

        // ── 8pm restriction ───────────────────────────────────────
        // After 20:00, only PREMIUM patients can send messages to doctors.
        // Doctors can always reply at any time.
        if (sender.getRole() == Role.PATIENT && LocalTime.now().getHour() >= 20) {
            UserSubscription sub = userSubscriptionRepository
                    .findByUserAndStatus(sender, "ACTIVE")
                    .orElse(null);
            boolean isPremium = sub != null &&
                    "PREMIUM".equalsIgnoreCase(sub.getSubscription().getCode().name());
            if (!isPremium) {
                // Notify the sender their message was blocked
                messagingTemplate.convertAndSend(
                        "/topic/chat." + sender.getId(),
                        Map.of(
                            "error", true,
                            "content", "Chat disponible uniquement pour les abonnés Premium après 20h."
                        )
                );
                return;
            }
        }

        // Update sender's presence on every message sent
        presenceService.ping(sender.getId());

        // content can be empty when the message is an image-only message
        String content = payload.getContent() != null ? payload.getContent() : "";

        ChatMessage saved = chatMessageRepository.save(
                ChatMessage.builder()
                        .sender(sender)
                        .receiver(receiver)
                        .content(content)
                        .imageUrl(payload.getImageUrl())
                        .build()
        );

        // send to receiver
        messagingTemplate.convertAndSend(
                "/topic/chat." + receiver.getId(),
                toResponse(saved, receiver.getId())
        );

        // send back to sender (so their own message appears)
        messagingTemplate.convertAndSend(
                "/topic/chat." + sender.getId(),
                toResponse(saved, sender.getId())
        );
    }

    // REST endpoint — send a chat message (saves + pushes via WebSocket to both parties)
    @PostMapping("/api/chats/{partnerId}/messages")
    public ResponseEntity<ChatMessageResponse> sendMessage(
            @PathVariable Long partnerId,
            @RequestParam Long userId,
            @RequestBody ChatMessagePayload payload) {

        User sender   = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Sender not found"));
        User receiver = userRepository.findById(partnerId)
                .orElseThrow(() -> new RuntimeException("Receiver not found"));

        // 8pm restriction check
        if (sender.getRole() == Role.PATIENT && LocalTime.now().getHour() >= 20) {
            UserSubscription sub = userSubscriptionRepository
                    .findByUserAndStatus(sender, "ACTIVE").orElse(null);
            boolean isPremium = sub != null &&
                    "PREMIUM".equalsIgnoreCase(sub.getSubscription().getCode().name());
            if (!isPremium) {
                return ResponseEntity.status(403)
                        .body(ChatMessageResponse.builder()
                                .content("Chat disponible uniquement pour les abonnés Premium après 20h.")
                                .build());
            }
        }

        presenceService.ping(sender.getId());

        String content = payload.getContent() != null ? payload.getContent() : "";
        ChatMessage saved = chatMessageRepository.save(
                ChatMessage.builder()
                        .sender(sender)
                        .receiver(receiver)
                        .content(content)
                        .imageUrl(payload.getImageUrl())
                        .build()
        );

        ChatMessageResponse responseForReceiver = toResponse(saved, receiver.getId());
        ChatMessageResponse responseForSender   = toResponse(saved, sender.getId());

        // push real-time to receiver
        messagingTemplate.convertAndSend("/topic/chat." + receiver.getId(), responseForReceiver);
        // push back to sender (other open tabs/devices)
        messagingTemplate.convertAndSend("/topic/chat." + sender.getId(), responseForSender);

        return ResponseEntity.ok(responseForSender);
    }

    // REST endpoint — load conversation history
    @GetMapping("/api/chats/{partnerId}/messages")
    public ResponseEntity<List<ChatMessageResponse>> getHistory(
            @PathVariable Long partnerId,
            @RequestParam Long userId) {

        User me = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        User partner = userRepository.findById(partnerId)
                .orElseThrow(() -> new RuntimeException("Partner not found"));

        List<ChatMessageResponse> messages = chatMessageRepository
                .findConversation(me, partner)
                .stream()
                .map(m -> toResponse(m, userId))
                .collect(Collectors.toList());

        return ResponseEntity.ok(messages);
    }

    // REST endpoint — get all users who have chatted with this user
    // Used by doctors to see patients who messaged them (even without appointment)
    @GetMapping("/api/chats/contacts")
    public ResponseEntity<List<Map<String, Object>>> getContacts(
            @RequestParam Long userId) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<ChatMessage> allMessages = chatMessageRepository
                .findBySenderOrReceiver(user, user);

        // Extract unique "other" users, preserving first-contact order
        Set<Long> seen = new LinkedHashSet<>();
        List<Map<String, Object>> contacts = new ArrayList<>();

        for (ChatMessage m : allMessages) {
            User other = m.getSender().getId().equals(userId)
                    ? m.getReceiver()
                    : m.getSender();
            if (seen.add(other.getId())) {
                Map<String, Object> c = new LinkedHashMap<>();
                c.put("id",        other.getId());
                c.put("firstName", other.getFirstName());
                c.put("lastName",  other.getLastName());
                c.put("role",      other.getRole().name());
                c.put("avatarUrl", other.getAvatarUrl());
                contacts.add(c);
            }
        }

        return ResponseEntity.ok(contacts);
    }

    private ChatMessageResponse toResponse(ChatMessage m, Long viewerId) {
        return ChatMessageResponse.builder()
                .id(m.getId())
                .senderId(m.getSender().getId())
                .senderName(m.getSender().getFirstName() + " " + m.getSender().getLastName())
                .receiverId(m.getReceiver().getId())
                .content(m.getContent())
                .imageUrl(m.getImageUrl())
                .sentAt(m.getSentAt())
                .mine(m.getSender().getId().equals(viewerId))
                .build();
    }
}
