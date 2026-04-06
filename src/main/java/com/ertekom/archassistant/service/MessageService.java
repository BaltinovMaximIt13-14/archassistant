package com.ertekom.archassistant.service;

import com.ertekom.archassistant.domain.entity.Chat;
import com.ertekom.archassistant.domain.entity.Message;
import com.ertekom.archassistant.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageRepository messageRepository;

    @Lazy
    private final ChatService chatService;

    @Transactional
    public Message createMessage(UUID chatId, String role, String content) {
        Chat chat = chatService.findById(chatId);

        Message message = new Message();
        message.setChat(chat);
        message.setRole(role);
        message.setContent(content);
        message.setCreatedAt(OffsetDateTime.now());

        return messageRepository.save(message);
    }

    public List<Message> getMessagesByChat(UUID chatId) {
        return messageRepository.findByChat_IdOrderByCreatedAtAsc(chatId);
    }

    public List<Message> findByChatId(UUID chatId) {
        return messageRepository.findByChat_IdOrderByCreatedAtAsc(chatId);
    }
}