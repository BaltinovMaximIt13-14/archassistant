package com.ertekom.archassistant.repository;

import com.ertekom.archassistant.domain.entity.KnowledgeSource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

public interface KnowledgeSourceRepository extends JpaRepository<KnowledgeSource, UUID> {
    @Modifying
    @Transactional
    @Query("UPDATE KnowledgeSource ks SET ks.lastSync = :lastSync WHERE ks.id = :id")
    int updateLastSync(@Param("id") UUID id, @Param("lastSync") OffsetDateTime lastSync);
}