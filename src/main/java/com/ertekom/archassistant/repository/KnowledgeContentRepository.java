package com.ertekom.archassistant.repository;

import com.ertekom.archassistant.domain.entity.KnowledgeContent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

public interface KnowledgeContentRepository extends JpaRepository<KnowledgeContent, UUID> {

    List<KnowledgeContent> findByFile_Id(UUID fileId);

    @Modifying
    @Transactional
    void deleteByFile_Source_Id(UUID sourceId);
}