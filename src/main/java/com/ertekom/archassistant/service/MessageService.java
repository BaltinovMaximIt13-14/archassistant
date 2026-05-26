package com.ertekom.archassistant.service;

import com.ertekom.archassistant.domain.entity.Chat;
import com.ertekom.archassistant.domain.entity.Message;
import com.ertekom.archassistant.domain.entity.MessageVersion;
import com.ertekom.archassistant.repository.MessageRepository;
import com.ertekom.archassistant.repository.MessageVersionRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE,makeFinal = true)
public class MessageService {

    MessageRepository messageRepository;
    MessageVersionRepository messageVersionRepository;

    @Lazy
    ChatService chatService;

    @Transactional
    public Message createMessage(UUID chatId, String role, String content) {
        Chat chat = chatService.findById(chatId);

        Message message = new Message();
        message.setChat(chat);
        message.setRole(role);
        message.setContent(content);
        message.setVersion(1);
        message.setEdited(false);
        message.setCreatedAt(OffsetDateTime.now());

        return messageRepository.save(message);
    }

    public List<Message> getMessagesByChat(UUID chatId) {
        return messageRepository.findByChat_IdOrderByCreatedAtAsc(chatId);
    }
    // Обновление сообщения
    @Transactional
    public Message updateMessage(UUID messageId, String newContent) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Сообщение не найдено: " + messageId));
        MessageVersion previousVersion = new MessageVersion();
        previousVersion.setMessage(message);
        previousVersion.setVersionNumber(message.getVersion() != null ? message.getVersion() : 1);
        previousVersion.setContent(message.getContent());
        messageVersionRepository.save(previousVersion);

        message.setContent(newContent);
        message.setVersion((message.getVersion() != null ? message.getVersion() : 1) + 1);
        message.setEdited(true);
        message.setUpdatedAt(LocalDateTime.now());
        return messageRepository.save(message);
    }

    public List<MessageVersion> getMessageVersions(UUID messageId) {
        return messageVersionRepository.findByMessage_IdOrderByVersionNumberAsc(messageId);
    }

    // Удаление сообщения
    @Transactional
    public void deleteMessage(UUID messageId) {
        messageVersionRepository.deleteByMessage_Id(messageId);
        messageRepository.deleteById(messageId);
    }
}
