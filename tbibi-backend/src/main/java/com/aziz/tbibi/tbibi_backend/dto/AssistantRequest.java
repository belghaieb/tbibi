package com.aziz.tbibi.tbibi_backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AssistantRequest {

    @NotBlank(message = "Message cannot be empty")
    private String message;
    // the text the patient typed in the assistant chat
    // example: "J'ai mal à la tête et de la fièvre"
    // our backend sends this to OpenAI and returns the response
}