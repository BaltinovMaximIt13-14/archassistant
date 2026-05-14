package com.ertekom.archassistant.repository;

import com.ertekom.archassistant.domain.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {
    List<Message> findByChat_IdOrderByCreatedAtAsc(UUID chatId);

    @Transactional
    void deleteByChat_Id(UUID chatId);
}