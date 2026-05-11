package com.ertekom.archassistant.repository;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE,makeFinal = true)
public class VectorStoreRepository {

    JdbcTemplate jdbcTemplate;

    public void deleteByChatId(UUID chatId) {
        String sql = "DELETE FROM vector_store WHERE metadata->>'chatId' = ?";
        jdbcTemplate.update(sql, chatId.toString());
    }

    public void deleteBySourceId(UUID sourceId) {
        String sql = "DELETE FROM vector_store WHERE metadata->>'sourceId' = ?";
        jdbcTemplate.update(sql, sourceId.toString());
    }

    public void deleteByDocumentId(UUID documentId) {
        String sql = "DELETE FROM vector_store WHERE metadata->>'documentId' = ?";
        jdbcTemplate.update(sql, documentId.toString());
    }
}