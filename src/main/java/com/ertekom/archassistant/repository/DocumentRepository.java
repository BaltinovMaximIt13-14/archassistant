package com.ertekom.archassistant.repository;

import com.ertekom.archassistant.domain.entity.Document;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

public interface DocumentRepository extends JpaRepository<Document, UUID> {

    List<Document> findByChat_Id(UUID chatId);

    List<Document> findByChat_IdOrderByCreatedAtDesc(UUID chatId);

    @Modifying
    @Transactional
    void deleteByChat_Id(UUID chatId);
}