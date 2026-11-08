package com.aziz.tbibi.tbibi_backend.repositories;

import com.aziz.tbibi.tbibi_backend.entities.ChatMessage;
import com.aziz.tbibi.tbibi_backend.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    // Gets all messages in a conversation between two users (in both directions)
    // Used to load chat history when a user opens a conversation
    // SQL: WHERE (sender=A AND receiver=B) OR (sender=B AND receiver=A)
    @Query("SELECT m FROM ChatMessage m WHERE " +
           "(m.sender = :userA AND m.receiver = :userB) OR " +
           "(m.sender = :userB AND m.receiver = :userA) " +
           "ORDER BY m.sentAt ASC")
    List<ChatMessage> findConversation(
        @Param("userA") User userA,
        @Param("userB") User userB
    );

    // Gets ALL messages where the user is the sender OR the receiver
    // Used during cascade delete — we delete all their messages before deleting the user
    // SQL: SELECT * FROM chat_messages WHERE sender_id = ? OR receiver_id = ?
    List<ChatMessage> findBySenderOrReceiver(User sender, User receiver);
}
