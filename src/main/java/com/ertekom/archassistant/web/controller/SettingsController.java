package com.ertekom.archassistant.web.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class SettingsController {

    private final JdbcTemplate jdbcTemplate;

    @PostMapping("/save")
    public ResponseEntity<Map<String, String>> saveSettings(@RequestBody Map<String, Object> request) {
        try {
            log.info("Получены настройки для сохранения: {}", request);

            if (request.containsKey("num_thread")) {
                int numThread = ((Number) request.get("num_thread")).intValue();
                int updated = jdbcTemplate.update(
                        "INSERT INTO app_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?) " +
                                "ON CONFLICT (setting_key) DO UPDATE SET setting_value = ?, updated_at = ?",
                        "num_thread", String.valueOf(numThread), LocalDateTime.now(),
                        String.valueOf(numThread), LocalDateTime.now()
                );
                log.info("num_thread обновлено, затронуто строк: {}", updated);
            }

            if (request.containsKey("temperature")) {
                double temperature = ((Number) request.get("temperature")).doubleValue();
                int updated = jdbcTemplate.update(
                        "INSERT INTO app_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?) " +
                                "ON CONFLICT (setting_key) DO UPDATE SET setting_value = ?, updated_at = ?",
                        "temperature", String.valueOf(temperature), LocalDateTime.now(),
                        String.valueOf(temperature), LocalDateTime.now()
                );
                log.info("temperature обновлено, затронуто строк: {}", updated);
            }

            // Проверка после сохранения
            verifySettings();

            return ResponseEntity.ok(Map.of("status", "success", "message", "Настройки сохранены"));

        } catch (Exception e) {
            log.error("Ошибка при сохранении настроек", e);
            return ResponseEntity.internalServerError().body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    @GetMapping("/load")
    public ResponseEntity<Map<String, String>> loadSettings() {
        try {
            Map<String, String> settings = new HashMap<>();

            // Безопасное получение значений
            String numThread = null;
            String temperature = null;

            try {
                numThread = jdbcTemplate.queryForObject(
                        "SELECT setting_value FROM app_settings WHERE setting_key = 'num_thread'",
                        String.class
                );
            } catch (Exception e) {
                log.warn("Настройка num_thread не найдена");
            }

            try {
                temperature = jdbcTemplate.queryForObject(
                        "SELECT setting_value FROM app_settings WHERE setting_key = 'temperature'",
                        String.class
                );
            } catch (Exception e) {
                log.warn("Настройка temperature не найдена");
            }

            settings.put("num_thread", numThread != null ? numThread : "8");
            settings.put("temperature", temperature != null ? temperature : "0.35");

            log.info("Загружены настройки: {}", settings);
            return ResponseEntity.ok(settings);

        } catch (Exception e) {
            log.error("Ошибка при загрузке настроек", e);
            return ResponseEntity.ok(Map.of("num_thread", "8", "temperature", "0.35"));
        }
    }

    // Вспомогательный метод для проверки
    private void verifySettings() {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM app_settings",
                    Integer.class
            );
            log.info("Всего записей в app_settings: {}", count);

            jdbcTemplate.query(
                    "SELECT setting_key, setting_value FROM app_settings",
                    (rs, rowNum) -> {
                        log.info("Запись: {} = {}", rs.getString("setting_key"), rs.getString("setting_value"));
                        return null;
                    }
            );
        } catch (Exception e) {
            log.error("Ошибка при проверке настроек", e);
        }
    }
}