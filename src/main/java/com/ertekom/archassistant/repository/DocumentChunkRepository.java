package com.ertekom.archassistant.repository;

import com.ertekom.archassistant.domain.entity.DocumentChunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

public interface DocumentChunkRepository extends JpaRepository<DocumentChunk, UUID> {

    List<DocumentChunk> findByDocument_Id(UUID documentId);


    List<DocumentChunk> findByChat_IdOrderByCreatedAtAsc(UUID chatId);

    @Modifying
    @Transactional
    void deleteByDocument_Id(UUID documentId);

    @Modifying
    @Transactional
    void deleteByChat_Id(UUID chatId);
}