package com.aziz.tbibi.tbibi_backend.controllers;

import com.aziz.tbibi.tbibi_backend.dto.AssistantRequest;
import com.aziz.tbibi.tbibi_backend.services.AssistantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/assistant")
// all endpoints start with /api/assistant
@RequiredArgsConstructor
public class AssistantController {

    private final AssistantService assistantService;

    @PostMapping("/chat")
    // handles POST /api/assistant/chat
    // frontend calls this when patient sends a message
    // to the AI assistant
    public ResponseEntity<Map<String, String>> chat(
            @Valid @RequestBody AssistantRequest request) {
        // @Valid       = validate the request
        // @RequestBody = read the JSON sent by frontend
        // example: { "message": "J'ai mal à la tête" }

        String reply =
                assistantService.chat(request.getMessage());
        // getMessage() = gets the message text from the DTO
        // reply = the response text from OpenAI

        return ResponseEntity.ok(
                Map.of("reply", reply));
        // Map.of("reply", reply) = builds a simple JSON response
        // example: { "reply": "Bonjour! Pour un mal de tête..." }
    }
}