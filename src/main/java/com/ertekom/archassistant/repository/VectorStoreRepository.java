package com.ertekom.archassistant.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class VectorStoreRepository {

    private final JdbcTemplate jdbcTemplate;

    public void save(UUID id, String content, String metadataJson, String embeddingVector) {
        String sql = """
            INSERT INTO vector_store (id, content, metadata, embedding)
            VALUES (?, ?, ?, ?::vector)
            ON CONFLICT (id) DO UPDATE SET
                content = EXCLUDED.content,
                metadata = EXCLUDED.metadata,
                embedding = EXCLUDED.embedding
            """;
        jdbcTemplate.update(sql, id, content, metadataJson, embeddingVector);
    }

    public void deleteById(UUID id) {
        String sql = "DELETE FROM vector_store WHERE id = ?";
        jdbcTemplate.update(sql, id);
    }

    public void deleteByMetadata(String key, String value) {
        String sql = "DELETE FROM vector_store WHERE metadata->>? = ?";
        jdbcTemplate.update(sql, key, value);
    }

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

    public List<Map<String, Object>> findByMetadata(String key, String value) {
        String sql = "SELECT id, content, metadata, embedding::text FROM vector_store WHERE metadata->>? = ?";
        return jdbcTemplate.queryForList(sql, key, value);
    }

    public int countByType(String type) {
        String sql = "SELECT COUNT(*) FROM vector_store WHERE metadata->>'type' = ?";
        return jdbcTemplate.queryForObject(sql, Integer.class, type);
    }
}