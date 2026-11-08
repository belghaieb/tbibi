package com.aziz.tbibi.tbibi_backend.config;

import org.springframework.ai.chat.client.ChatClient;
// ChatClient = Spring AI's tool for talking to OpenAI
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ChatClientConfig {

    @Bean
    public ChatClient chatClient(
            ChatClient.Builder builder) {
        // ChatClient.Builder = Spring AI automatically creates
        // this builder using our OpenAI API key
        // from application.properties
        // we just call build() to get the final ChatClient object
        return builder.build();
    }
}