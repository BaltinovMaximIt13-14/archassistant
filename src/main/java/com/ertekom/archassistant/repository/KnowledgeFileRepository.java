package com.ertekom.archassistant.repository;

import com.ertekom.archassistant.domain.entity.KnowledgeFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface KnowledgeFileRepository extends JpaRepository<KnowledgeFile, UUID> {

    List<KnowledgeFile> findBySource_Id(UUID sourceId);

    List<KnowledgeFile> findBySource_IdAndIsCurrentTrue(UUID sourceId);

    Optional<KnowledgeFile> findByFileHash(String fileHash);

    @Modifying
    @Transactional
    @Query("UPDATE KnowledgeFile kf SET kf.isCurrent = false WHERE kf.source.id = :sourceId AND kf.fileName = :fileName")
    int markPreviousAsNotCurrent(@Param("sourceId") UUID sourceId, @Param("fileName") String fileName);

    @Modifying
    @Transactional
    void deleteBySource_Id(UUID sourceId);
}