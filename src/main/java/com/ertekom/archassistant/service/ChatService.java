package com.ertekom.archassistant.service;

import com.ertekom.archassistant.domain.entity.Chat;
import com.ertekom.archassistant.domain.entity.Message;
import com.ertekom.archassistant.repository.ChatRepository;
import com.ertekom.archassistant.repository.DocumentChunkRepository;
import com.ertekom.archassistant.repository.DocumentRepository;
import com.ertekom.archassistant.repository.MessageRepository;
import com.ertekom.archassistant.repository.VectorStoreRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE,makeFinal = true)
public class ChatService {

    ChatRepository chatRepository;
    MessageRepository messageRepository;
    DocumentRepository documentRepository;
    DocumentChunkRepository documentChunkRepository;
    VectorStoreRepository vectorStoreRepository;

    @Transactional
    public Chat createChat(String title) {
        Chat chat = new Chat();
        chat.setTitle(title != null ? title : "Новый чат");
        chat.setCreatedAt(LocalDateTime.now());
        chat.setUpdatedAt(LocalDateTime.now());
        return chatRepository.save(chat);
    }

    public List<Chat> getAllChats() {
        return chatRepository.findAllOrderByUpdatedAtDesc();
    }

    public Chat getChatById(UUID id) {
        return chatRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Чат не найден: " + id));
    }

    public Chat findById(UUID id) {
        return getChatById(id);
    }

    public List<Message> getChatMessages(UUID chatId) {
        return messageRepository.findByChat_IdOrderByCreatedAtAsc(chatId);
    }

    @Transactional
    public Chat updateChatTitle(UUID id, String title) {
        chatRepository.updateTitle(id, title, LocalDateTime.now());
        return getChatById(id);
    }

    @Transactional
    public void deleteChat(UUID id) {
        vectorStoreRepository.deleteByChatId(id);
        documentChunkRepository.deleteByChat_Id(id);
        documentRepository.deleteByChat_Id(id);
        messageRepository.deleteByChat_Id(id);
        chatRepository.deleteById(id);
    }

    public List<Chat> findAll() {
        return getAllChats();
    }
}