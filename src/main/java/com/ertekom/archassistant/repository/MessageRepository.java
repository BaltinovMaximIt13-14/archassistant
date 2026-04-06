package com.ertekom.archassistant.repository;
import com.ertekom.archassistant.domain.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    List<Message> findByChat_IdOrderByCreatedAtAsc(UUID chatId);

    List<Message> findByChat_IdAndRole(UUID chatId, String role);

    @Modifying
    @Transactional
    void deleteByChat_Id(UUID chatId);

    @Query("SELECT m FROM Message m WHERE m.chat.id = :chatId ORDER BY m.createdAt DESC LIMIT :limit")
    List<Message> findLastMessages(@Param("chatId") UUID chatId, @Param("limit") int limit);
}