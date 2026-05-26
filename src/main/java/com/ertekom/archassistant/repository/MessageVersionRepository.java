package com.ertekom.archassistant.repository;

import com.ertekom.archassistant.domain.entity.MessageVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MessageVersionRepository extends JpaRepository<MessageVersion, UUID> {
    List<MessageVersion> findByMessage_IdOrderByVersionNumberAsc(UUID messageId);

    void deleteByMessage_Id(UUID messageId);

    void deleteByMessage_Chat_Id(UUID chatId);
}
