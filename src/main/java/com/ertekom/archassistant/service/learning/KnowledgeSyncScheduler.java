package com.ertekom.archassistant.service.learning;

import com.ertekom.archassistant.domain.entity.KnowledgeSource;
import com.ertekom.archassistant.repository.KnowledgeSourceRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.util.List;


@Slf4j
@Service
@EnableScheduling
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class KnowledgeSyncScheduler {

    KnowledgeSourceRepository sourceRepository;
    GitLabSyncService gitLabSyncService;

    @Scheduled(cron = "${learning.schedule:0 0 3 1 * ?}")
    public void syncAllSourcesMonthly() {
        log.info("Запуск плановой синхронизации всех источников знаний");

        List<KnowledgeSource> sources = sourceRepository.findAll();

        if (sources.isEmpty()) {
            log.info("Нет добавленных источников знаний. Синхронизация не требуется.");
            return;
        }

        int successCount = 0;
        int failCount = 0;

        for (KnowledgeSource source : sources) {
            try {
                log.info("Синхронизация источника: {} ({})", source.getRepositoryUrl(), source.getId());
                gitLabSyncService.syncKnowledgeSource(source);
                successCount++;
            } catch (Exception e) {
                failCount++;
                log.error("Ошибка синхронизации источника {}: {}", source.getRepositoryUrl(), e.getMessage(), e);
            }
        }

        log.info("Плановая синхронизация завершена. Успешно: {}, Ошибок: {}", successCount, failCount);
    }
}