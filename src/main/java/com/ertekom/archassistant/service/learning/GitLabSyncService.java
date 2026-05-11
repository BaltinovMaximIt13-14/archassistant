package com.ertekom.archassistant.service.learning;

import com.ertekom.archassistant.domain.entity.KnowledgeContent;
import com.ertekom.archassistant.domain.entity.KnowledgeFile;
import com.ertekom.archassistant.domain.entity.KnowledgeSource;
import com.ertekom.archassistant.repository.KnowledgeContentRepository;
import com.ertekom.archassistant.repository.KnowledgeFileRepository;
import com.ertekom.archassistant.repository.KnowledgeSourceRepository;
import com.ertekom.archassistant.service.TextExtractorService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.FileSystemUtils;

import java.io.File;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.HashMap;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE,makeFinal = true)
public class GitLabSyncService {

    KnowledgeSourceRepository sourceRepository;
    KnowledgeFileRepository fileRepository;
    KnowledgeContentRepository contentRepository;
    EmbeddingModel embeddingModel;
    JdbcTemplate jdbcTemplate;
    TextExtractorService textExtractorService;

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

            File knowledgeRoot = resolveKnowledgeRoot(localRepo, source.getLocalPath());
            clearSourceKnowledge(source.getId());
            processDirectory(knowledgeRoot, source, knowledgeRoot.toPath());

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

    private File resolveKnowledgeRoot(File localRepo, String localPath) throws IOException {
        Path repoPath = localRepo.toPath().toAbsolutePath().normalize();
        String normalizedLocalPath = localPath == null ? "" : localPath.replace("\\", "/").trim();
        while (normalizedLocalPath.startsWith("/")) {
            normalizedLocalPath = normalizedLocalPath.substring(1);
        }

        Path rootPath = normalizedLocalPath.isBlank()
                ? repoPath
                : repoPath.resolve(normalizedLocalPath).normalize();

        if (!rootPath.startsWith(repoPath)) {
            throw new IOException("Пути к источникам знаний находятся вне репозитория: " + localPath);
        }
        if (!Files.exists(rootPath) || !Files.isDirectory(rootPath)) {
            log.warn("Путь к источнику знаний '{}' не найден, корневой каталог репозитория будет просканирован", localPath);
            return repoPath.toFile();
        }
        return rootPath.toFile();
    }

    private void clearSourceKnowledge(UUID sourceId) {
        jdbcTemplate.update("DELETE FROM vector_store WHERE metadata->>'sourceId' = ?", sourceId.toString());
        contentRepository.deleteByFile_Source_Id(sourceId);
        fileRepository.deleteBySource_Id(sourceId);
    }

    private void processDirectory(File dir, KnowledgeSource source, Path rootPath) {
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File file : files) {
            if (file.isDirectory()) {
                if (!".git".equals(file.getName())) {
                    processDirectory(file, source, rootPath);
                }
            } else if (isSupportedFile(file.getName())) {
                try {
                    processFile(file, source, rootPath);
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
                lower.endsWith(".odt") ||
                lower.endsWith(".png") || lower.endsWith(".jpg") ||
                lower.endsWith(".jpeg") || lower.endsWith(".tif") ||
                lower.endsWith(".tiff") || lower.endsWith(".bmp");
    }

    private void processFile(File file, KnowledgeSource source, Path rootPath) throws Exception {
        log.debug("Обработка файла: {}", file.getName());

        String text = normalizeText(textExtractorService.extractText(file));
        if (text == null || text.isBlank()) {
            log.warn("Не удалось извлечь текст из {}", file.getName());
            return;
        }

        String relativePath = toRelativePath(rootPath, file.toPath());
        KnowledgeFile knowledgeFile = new KnowledgeFile();
        knowledgeFile.setFileName(file.getName());
        knowledgeFile.setFilePath(relativePath);
        knowledgeFile.setFileHash(calculateHash(file.toPath()));
        knowledgeFile.setVersion(1);
        knowledgeFile.setIsCurrent(true);
        knowledgeFile.setSource(source);
        knowledgeFile = fileRepository.save(knowledgeFile);

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
            metadata.put("fileName", knowledgeFile.getFileName());
            metadata.put("filePath", knowledgeFile.getFilePath());
            metadata.put("sourceId", source.getId().toString());
            metadata.put("type", "KNOWLEDGE_BASE");
            String metadataJson = toJson(metadata);

            jdbcTemplate.update(sql, UUID.randomUUID(), content.getChunkContent(), metadataJson, vectorStr);
        }

        log.info("Файл {} обработан, создано {} чанков и добавлено в vector_store", file.getName(), chunks.size());
    }

    private String normalizeText(String text) {
        if (text == null) return "";
        return text
                .replace("\r\n", "\n")
                .replace('\r', '\n')
                .trim();
    }

    private String toRelativePath(Path rootPath, Path filePath) {
        return rootPath.toAbsolutePath()
                .normalize()
                .relativize(filePath.toAbsolutePath().normalize())
                .toString()
                .replace("\\", "/");
    }

    private String calculateHash(Path filePath) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(Files.readAllBytes(filePath));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
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
            sb.append("\"").append(escapeJson(entry.getKey())).append("\":\"")
                    .append(escapeJson(entry.getValue())).append("\"");
        }
        sb.append("}");
        return sb.toString();
    }

    private String escapeJson(String value) {
        return value == null ? "" : value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"");
    }
}
