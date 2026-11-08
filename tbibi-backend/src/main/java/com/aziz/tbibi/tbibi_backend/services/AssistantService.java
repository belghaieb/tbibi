package com.aziz.tbibi.tbibi_backend.services;

import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.client.ChatClient;
// ChatClient = Spring AI's tool for talking to OpenAI
// it handles the API call, authentication and response
// we just give it a message and it returns the AI response
import org.springframework.ai.chat.messages.SystemMessage;
// SystemMessage = a special message that defines how the AI
// should behave - like giving instructions to the AI
// example: "You are a medical assistant for TBIBI platform"
import org.springframework.ai.chat.messages.UserMessage;
// UserMessage = the actual message typed by the patient
import org.springframework.ai.chat.prompt.Prompt;
// Prompt = combines the SystemMessage and UserMessage
// into one complete request to send to OpenAI
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AssistantService {

    private final ChatClient chatClient;
    // ChatClient = Spring AI automatically creates this object
    // using our API key from application.properties
    // we just inject it and use it

    private static final String SYSTEM_PROMPT =
            "You are TBIBI Assistant, a helpful medical assistant " +
                    "for the TBIBI healthcare platform in Tunisia. " +
                    "Your role is to: " +
                    "1. Help patients understand their symptoms. " +
                    "2. Suggest which type of specialist they should consult. " +
                    "3. Provide general health information. " +
                    "4. Answer questions about the TBIBI platform. " +
                    "Always remind patients that your advice does not " +
                    "replace a real medical consultation. " +
                    "Respond in the same language the patient uses " +
                    "(French, Arabic or English). " +
                    "Keep your responses clear, friendly and concise.";
    // SYSTEM_PROMPT = instructions we give to the AI
    // before every conversation
    // this defines the personality and rules of our assistant

    public String chat(String userMessage) {
        // sends a message to OpenAI and returns the response

        // Step 1: create the system message
        SystemMessage systemMessage =
                new SystemMessage(SYSTEM_PROMPT);
        // SystemMessage = tells OpenAI how to behave
        // sent with every request

        // Step 2: create the user message
        UserMessage userMsg =
                new UserMessage(userMessage);
        // UserMessage = the patient's actual question
        // example: "J'ai mal à la tête depuis 3 jours"

        // Step 3: combine into a prompt
        Prompt prompt = new Prompt(
                List.of(systemMessage, userMsg));
        // List.of() = creates a list with both messages
        // OpenAI receives both and responds accordingly

        // Step 4: send to OpenAI and get response
        return chatClient
                .prompt(prompt)
                .call()
                .content();
        // prompt() = sets the messages to send
        // call()   = sends the request to OpenAI API
        // content() = extracts the text from the response
    }
}