package com.ertekom.archassistant.repository;

import com.ertekom.archassistant.domain.entity.KnowledgeFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import java.util.UUID;

public interface KnowledgeFileRepository extends JpaRepository<KnowledgeFile, UUID> {

    List<KnowledgeFile> findBySource_Id(UUID sourceId);

    @Modifying
    @Transactional
    void deleteBySource_Id(UUID sourceId);
}