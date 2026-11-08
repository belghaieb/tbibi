package com.aziz.tbibi.tbibi_backend.dto;

import lombok.Data;

@Data
public class ChatMessagePayload {
    private Long senderId;
    private Long receiverId;
    private String content;
    private String imageUrl; // optional — set when sending a photo
}
