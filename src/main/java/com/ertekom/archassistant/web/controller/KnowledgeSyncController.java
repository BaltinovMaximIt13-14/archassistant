package com.ertekom.archassistant.web.controller;

import com.ertekom.archassistant.domain.entity.KnowledgeSource;
import com.ertekom.archassistant.repository.KnowledgeSourceRepository;
import com.ertekom.archassistant.service.learning.GitLabSyncService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/knowledge/sync")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE,makeFinal = true)
public class KnowledgeSyncController {

    GitLabSyncService syncService;
    KnowledgeSourceRepository sourceRepository;

    @PostMapping("/{sourceId}")
    public ResponseEntity<Map<String, String>> syncSource(@PathVariable UUID sourceId) {
        log.info("Получен запрос на синхронизацию источника с ID: {}", sourceId);

        KnowledgeSource source = sourceRepository.findById(sourceId)
                .orElse(null);

        if (source == null) {
            log.warn("Источник с ID {} не найден", sourceId);
            Map<String, String> error = new HashMap<>();
            error.put("status", "error");
            error.put("message", "Источник не найден");
            return ResponseEntity.notFound().build();
        }

        try {
            syncService.syncKnowledgeSource(source);
            Map<String, String> response = new HashMap<>();
            response.put("status", "success");
            response.put("message", "Синхронизация источника '" + source.getRepositoryUrl() + "' успешно завершена");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Ошибка при синхронизации источника {}: {}", sourceId, e.getMessage(), e);
            Map<String, String> error = new HashMap<>();
            error.put("status", "error");
            error.put("message", "Ошибка синхронизации: " + e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    @PostMapping("/all")
    public ResponseEntity<Map<String, String>> syncAllSources() {
        log.info("Получен запрос на синхронизацию ВСЕХ источников знаний");

        var sources = sourceRepository.findAll();
        if (sources.isEmpty()) {
            Map<String, String> response = new HashMap<>();
            response.put("status", "warning");
            response.put("message", "Нет источников для синхронизации");
            return ResponseEntity.ok(response);
        }

        int successCount = 0;
        int failCount = 0;

        for (KnowledgeSource source : sources) {
            try {
                syncService.syncKnowledgeSource(source);
                successCount++;
                log.info("Синхронизирован источник: {}", source.getRepositoryUrl());
            } catch (Exception e) {
                failCount++;
                log.error("Не удалось синхронизировать {}: {}", source.getRepositoryUrl(), e.getMessage());
            }
        }

        Map<String, String> response = new HashMap<>();
        response.put("status", "completed");
        response.put("message", String.format("Синхронизация завершена. Успешно: %d, Ошибок: %d", successCount, failCount));
        return ResponseEntity.ok(response);
    }
}