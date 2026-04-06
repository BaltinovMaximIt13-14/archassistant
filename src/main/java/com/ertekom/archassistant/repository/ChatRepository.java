package com.ertekom.archassistant.repository;

import com.ertekom.archassistant.domain.entity.Chat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface ChatRepository extends JpaRepository<Chat, UUID> {

    List<Chat> findByTitleContainingIgnoreCase(String title);

    @Query("SELECT c FROM Chat c ORDER BY c.updatedAt DESC")
    List<Chat> findAllOrderByUpdatedAtDesc();

    @Modifying
    @Transactional
    @Query("UPDATE Chat c SET c.title = :title, c.updatedAt = :updatedAt WHERE c.id = :id")
    int updateTitle(@Param("id") UUID id, @Param("title") String title, @Param("updatedAt") LocalDateTime updatedAt);
}