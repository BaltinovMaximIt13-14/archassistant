package com.ertekom.archassistant.service.learning;

import com.ertekom.archassistant.domain.entity.KnowledgeContent;
import com.ertekom.archassistant.domain.entity.KnowledgeFile;
import com.ertekom.archassistant.domain.entity.KnowledgeSource;
import com.ertekom.archassistant.repository.KnowledgeContentRepository;
import com.ertekom.archassistant.repository.KnowledgeFileRepository;
import com.ertekom.archassistant.repository.KnowledgeSourceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.apache.tika.exception.TikaException;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.FileSystemUtils;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class GitLabSyncService {

    private final KnowledgeSourceRepository sourceRepository;
    private final KnowledgeFileRepository fileRepository;
    private final KnowledgeContentRepository contentRepository;
    private final EmbeddingModel embeddingModel;
    private final JdbcTemplate jdbcTemplate;
    private final Tika tika = new Tika();

    @Transactional
    public void syncKnowledgeSource(KnowledgeSource source) throws IOException, GitAPIException {
        log.info("Синхронизация источника: {}", source.getRepositoryUrl());

        Path tempDir = Files.createTempDirectory("gitlab-sync-" + source.getId());
        File localRepo = tempDir.toFile();

        try (Git git = Git.cloneRepository()
                .setURI(source.getRepositoryUrl())
                .setBranch(source.getBranch())
                .setDirectory(localRepo)
                .call()) {

            processDirectory(localRepo, source);

            source.setLastSync(OffsetDateTime.now());
            sourceRepository.save(source);

            log.info("Синхронизация завершена для {}", source.getRepositoryUrl());
        } catch (Exception e) {
            log.error("Ошибка синхронизации: {}", e.getMessage(), e);
            throw e;
        } finally {
            try {
                FileSystemUtils.deleteRecursively(tempDir);
            } catch (IOException e) {
                log.warn("Не удалось удалить временную папку {}: {}", tempDir, e.getMessage());
                localRepo.deleteOnExit();
            }
        }
    }

    private void processDirectory(File dir, KnowledgeSource source) {
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File file : files) {
            if (file.isDirectory()) {
                processDirectory(file, source);
            } else if (isSupportedFile(file.getName())) {
                try {
                    processFile(file, source);
                } catch (Exception e) {
                    log.error("Ошибка обработки файла {}: {}", file.getName(), e.getMessage());
                }
            }
        }
    }

    private boolean isSupportedFile(String fileName) {
        String lower = fileName.toLowerCase();
        return lower.endsWith(".txt") || lower.endsWith(".md") ||
                lower.endsWith(".pdf") || lower.endsWith(".docx") ||
                lower.endsWith(".odt");
    }

    private void processFile(File file, KnowledgeSource source) throws IOException, TikaException {
        log.debug("Обработка файла: {}", file.getName());

        String text = tika.parseToString(file);
        if (text == null || text.isBlank()) {
            log.warn("Не удалось извлечь текст из {}", file.getName());
            return;
        }

        // Сохраняем метаданные файла
        KnowledgeFile knowledgeFile = new KnowledgeFile();
        knowledgeFile.setFileName(file.getName());
        knowledgeFile.setFilePath(file.getAbsolutePath());
        knowledgeFile.setIsCurrent(true);
        knowledgeFile.setSource(source);
        knowledgeFile = fileRepository.save(knowledgeFile);

        // Разбиваем на чанки (по 1000 символов)
        List<String> chunks = splitIntoChunks(text, 1000);
        List<KnowledgeContent> contents = new ArrayList<>();
        for (int i = 0; i < chunks.size(); i++) {
            KnowledgeContent content = new KnowledgeContent();
            content.setChunkIndex(i);
            content.setChunkContent(chunks.get(i));
            content.setFile(knowledgeFile);
            content.setCreatedAt(OffsetDateTime.now());
            contents.add(content);
        }
        contentRepository.saveAll(contents);

        // 🔥 Ручное сохранение эмбеддингов в vector_store
        for (KnowledgeContent content : contents) {
            float[] embedding = embeddingModel.embed(content.getChunkContent());
            String vectorStr = arrayToPgVector(embedding);
            String sql = """
                INSERT INTO vector_store (id, content, metadata, embedding)
                VALUES (?, ?, ?::jsonb, ?::vector)
                """;
            Map<String, String> metadata = new HashMap<>();
            metadata.put("contentId", content.getId().toString());
            metadata.put("fileId", knowledgeFile.getId().toString());
            metadata.put("sourceId", source.getId().toString());
            metadata.put("type", "KNOWLEDGE_BASE");
            String metadataJson = toJson(metadata);

            jdbcTemplate.update(sql, UUID.randomUUID(), content.getChunkContent(), metadataJson, vectorStr);
        }

        log.info("Файл {} обработан, создано {} чанков и добавлено в vector_store", file.getName(), chunks.size());
    }

    private List<String> splitIntoChunks(String text, int chunkSize) {
        List<String> chunks = new ArrayList<>();
        for (int i = 0; i < text.length(); i += chunkSize) {
            int end = Math.min(i + chunkSize, text.length());
            chunks.add(text.substring(i, end));
        }
        return chunks;
    }

    private String arrayToPgVector(float[] arr) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(arr[i]);
        }
        sb.append("]");
        return sb.toString();
    }

    private String toJson(Map<String, String> map) {
        StringBuilder sb = new StringBuilder("{");
        int count = 0;
        for (Map.Entry<String, String> entry : map.entrySet()) {
            if (count++ > 0) sb.append(",");
            sb.append("\"").append(entry.getKey()).append("\":\"").append(entry.getValue()).append("\"");
        }
        sb.append("}");
        return sb.toString();
    }
}