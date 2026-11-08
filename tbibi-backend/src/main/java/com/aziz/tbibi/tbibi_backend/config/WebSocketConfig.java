package com.aziz.tbibi.tbibi_backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
// MessageBrokerRegistry = configures how messages are routed
// between the frontend and backend in real time

import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
// @EnableWebSocketMessageBroker = activates the WebSocket system
// in our Spring application

import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
// StompEndpointRegistry = registers the connection points
// that the frontend will use to connect to our WebSocket

import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
// WebSocketMessageBrokerConfigurer = Spring interface that lets us
// configure the WebSocket message system

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // configureMessageBroker = defines how messages travel
        // between users in the chat

        registry.enableSimpleBroker("/topic", "/queue");
        // /topic = used for broadcasting to multiple users
        // /queue = used for sending to one specific user
        // example: doctor sends message → goes to patient's /queue

        registry.setApplicationDestinationPrefixes("/app");
        // /app = prefix for messages coming FROM the frontend
        // example: frontend sends to "/app/chat"
        // Spring receives it and processes it
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // registerStompEndpoints = defines the URL the frontend
        // uses to establish the WebSocket connection

        // STOMP = a simple protocol for sending messages
        // think of it as the "language" of our chat system

        registry.addEndpoint("/ws")
                // /ws = the URL the frontend connects to
                // example: new WebSocket("ws://localhost:8080/ws")

                .setAllowedOriginPatterns("*")
                // allow all origins so Live Server on any port can connect

                .withSockJS();
        // SockJS = a fallback library
        // if the browser does not support WebSocket natively
        // SockJS automatically uses an alternative method
        // so the chat always works regardless of the browser
    }
}