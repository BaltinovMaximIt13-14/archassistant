package com.ertekom.archassistant.repository;

import com.ertekom.archassistant.domain.entity.Document;
import com.ertekom.archassistant.domain.entity.enums.DocumentType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentRepository extends JpaRepository<Document, UUID> {

    List<Document> findByChat_Id(UUID chatId);

    List<Document> findByChat_IdOrderByCreatedAtDesc(UUID chatId);

    List<Document> findByDocumentType(DocumentType documentType);

    List<Document> findByChat_IdAndDocumentType(UUID chatId, DocumentType documentType);

    Optional<Document> findByFileHash(String fileHash);

    @Modifying
    @Transactional
    void deleteByChat_Id(UUID chatId);

    @Modifying
    @Transactional
    @Query("DELETE FROM Document d WHERE d.chat.id = :chatId AND d.id = :documentId")
    int deleteByChatIdAndDocumentId(@Param("chatId") UUID chatId, @Param("documentId") UUID documentId);
}