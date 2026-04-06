package com.ertekom.archassistant.service;

import com.ertekom.archassistant.domain.entity.Chat;
import com.ertekom.archassistant.domain.entity.Document;
import com.ertekom.archassistant.domain.entity.DocumentChunk;
import com.ertekom.archassistant.repository.DocumentChunkRepository;
import com.ertekom.archassistant.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DocumentChunkService {

    private final DocumentChunkRepository chunkRepository;
    private final DocumentRepository documentRepository;
    private final ChatService chatService;

    @Transactional
    public DocumentChunk create(UUID documentId, UUID chatId, Integer chunkIndex, String chunkContent) {
        // Напрямую получаем Document из репозитория
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new RuntimeException("Document not found: " + documentId));

        Chat chat = chatService.findById(chatId);

        DocumentChunk chunk = new DocumentChunk();
        chunk.setDocument(document);
        chunk.setChat(chat);
        chunk.setChunkIndex(chunkIndex);
        chunk.setChunkContent(chunkContent);
        chunk.setCreatedAt(OffsetDateTime.now());

        return chunkRepository.save(chunk);
    }

    public List<DocumentChunk> findByDocumentId(UUID documentId) {
        return chunkRepository.findByDocument_Id(documentId);
    }

    public List<DocumentChunk> findByChatId(UUID chatId) {
        return chunkRepository.findByChat_IdOrderByCreatedAtAsc(chatId);
    }

    @Transactional
    public void deleteByDocumentId(UUID documentId) {
        chunkRepository.deleteByDocument_Id(documentId);
    }

    @Transactional
    public void deleteByChatId(UUID chatId) {
        chunkRepository.deleteByChat_Id(chatId);
    }
}