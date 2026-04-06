package com.ertekom.archassistant.repository;

import com.ertekom.archassistant.domain.entity.KnowledgeContent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

public interface KnowledgeContentRepository extends JpaRepository<KnowledgeContent, UUID> {

    List<KnowledgeContent> findByFile_Id(UUID fileId);

    List<KnowledgeContent> findByFile_Source_Id(UUID sourceId);

    @Modifying
    @Transactional
    void deleteByFile_Id(UUID fileId);

    @Modifying
    @Transactional
    void deleteByFile_Source_Id(UUID sourceId);

    @Query("SELECT kc FROM KnowledgeContent kc WHERE kc.file.source.id = :sourceId ORDER BY kc.file.fileName, kc.chunkIndex")
    List<KnowledgeContent> findAllBySourceIdOrdered(@Param("sourceId") UUID sourceId);
}