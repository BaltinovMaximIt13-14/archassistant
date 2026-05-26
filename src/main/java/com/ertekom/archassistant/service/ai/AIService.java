package com.ertekom.archassistant.service.ai;

import com.ertekom.archassistant.domain.entity.Document;
import com.ertekom.archassistant.repository.DocumentRepository;
import com.ertekom.archassistant.service.learning.KnowledgeSearchService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE,makeFinal = true)
public class AIService {

  OllamaChatModel chatModel;
  KnowledgeSearchService searchService;
  DocumentRepository documentRepository;
  JdbcTemplate jdbcTemplate;
  ConcurrentMap<String, String> validationReportCache = new ConcurrentHashMap<>();

  private static final int TOP_K = 5;
  private static final int VALIDATION_TOP_K = 3;
  private static final int VALIDATION_CACHE_LIMIT = 100;
  private static final int MAX_VALIDATION_SOLUTION_CHARS = 8_000;
  private static final int MAX_CONTEXT_CHUNK_CHARS = 900;
  private static final String VALIDATION_SEARCH_PREFIX = """
      OpenAPI TOGAF ArchiMate TM Forum SID Security Data Integration DevOps Infrastructure
      """;
  private static final String FAST_VALIDATION_REPORT_FORMAT = """
      # Architecture Compliance Validation Report

      ## 1. Общая информация
      | Поле | Значение |
      |---|---|
      | Название проекта | <из решения или "Не указано"> |
      | Дата проверки | <дата> |
      | Проверяющая система | ArchAssistant |
      | Общий статус | PASSED / WARNING / FAILED |
      | Общий уровень зрелости | <0-100>/100 |
      | Критичность нарушений | LOW / MEDIUM / HIGH / CRITICAL |

      ## 2. Сводка проверки
      **Общий результат:** <2-3 предложения>

      ## 3. Нарушения
      1. <КОД-001>: <что нужно исправить>
         Файл: <имя файла или "Текст пользователя">
         Пункт документа: <заголовок/раздел/фрагмент или "Не указан">
         Severity: LOW / MEDIUM / HIGH / CRITICAL
         Описание: <конкретный факт из решения>
         Рекомендация: <конкретное исправление>

      ## 4. Пройденные проверки
      1. П-001: <что соответствует стандартам>
         Файл: <имя файла или "Текст пользователя">
         Пункт документа: <заголовок/раздел/фрагмент или "Не указан">
         Обоснование: <короткий факт из решения>

      ## 5. Оценка по областям
      | Область | Оценка | Статус |
      |---|---:|---|
      | Security | <0-100>% | PASSED / WARNING / FAILED |
      | Data | <0-100>% | PASSED / WARNING / FAILED |
      | Integration | <0-100>% | PASSED / WARNING / FAILED |
      | Infrastructure | <0-100>% | PASSED / WARNING / FAILED |
      | API Governance | <0-100>% | PASSED / WARNING / FAILED |
      | TM Forum | <0-100>% | PASSED / WARNING / FAILED |
      | TOGAF | <0-100>% | PASSED / WARNING / FAILED |
      | ArchiMate | <0-100>% | PASSED / WARNING / FAILED |
      | DevOps | <0-100>% | PASSED / WARNING / FAILED |

      ## 6. Рекомендации по улучшению
      ### Приоритет 1 (критично)
      1. <исправления HIGH/CRITICAL>
      ### Приоритет 2 (важно)
      1. <исправления MEDIUM>
      ### Приоритет 3 (улучшения)
      1. <исправления LOW/INFO>

      ## 7. Machine Readable Summary
      {"overallScore":0,"status":"PASSED|WARNING|FAILED","criticalViolations":0,"highViolations":0,"passedChecks":0,"failedChecks":0,"warningChecks":0,"domains":{"security":0,"data":0,"integration":0,"infrastructure":0,"api":0,"tmforum":0,"togaf":0,"archimate":0,"devops":0}}
      """;

  private List<Map<String, String>> getChatHistory(UUID chatId) {
    if (chatId == null) return new ArrayList<>();
    try {
      String sql = """
                SELECT role, content FROM messages 
                WHERE chat_id = ? 
                ORDER BY created_at ASC 
                LIMIT 20
                """;
      List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, chatId);
      return rows.stream()
          .map(row -> Map.of(
              "role", (String) row.get("role"),
              "content", (String) row.get("content")
          ))
          .collect(Collectors.toList());
    } catch (Exception e) {
      log.error("Ошибка получения истории: {}", e.getMessage());
      return new ArrayList<>();
    }
  }

  private String buildHistoryContext(List<Map<String, String>> history) {
    if (history.isEmpty()) return "";
    StringBuilder sb = new StringBuilder("## ИСТОРИЯ ДИАЛОГА\n\n");
    for (var msg : history) {
      String prefix = "user".equals(msg.get("role")) ? "👤 Пользователь" : "🤖 Ассистент";
      sb.append(String.format("**%s:** %s\n\n", prefix, msg.get("content")));
    }
    return sb.toString();
  }

  private String validationCacheKey(String solution, String criteriaContext) {
    return sha256(criteriaContext + "\n---SOLUTION---\n" + solution);
  }

  private String sha256(String value) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 недоступен", e);
    }
  }

  private void cacheValidationReport(String cacheKey, String report) {
    if (report == null || report.isBlank()) return;
    if (validationReportCache.size() >= VALIDATION_CACHE_LIMIT) {
      validationReportCache.clear();
    }
    validationReportCache.put(cacheKey, report);
  }

  private String limitText(String text, int maxChars) {
    if (text == null || text.length() <= maxChars) return text;
    return text.substring(0, maxChars) + "\n...[фрагмент сокращён для ускорения локальной проверки]...";
  }

  private String prepareSolutionForValidation(String solution) {
    if (solution == null || solution.length() <= MAX_VALIDATION_SOLUTION_CHARS) {
      return solution;
    }

    int headSize = MAX_VALIDATION_SOLUTION_CHARS * 2 / 3;
    int tailSize = MAX_VALIDATION_SOLUTION_CHARS - headSize;
    return solution.substring(0, headSize)
        + "\n\n...[середина документа сокращена для ускорения локальной LLM; проверяются начало и финальные разделы]...\n\n"
        + solution.substring(solution.length() - tailSize);
  }

  public Flux<String> askStream(String question, UUID chatId) {
    try {
      List<String> chunks = searchService.findRelevantChunks(question, TOP_K);
      String context = chunks.isEmpty() ? "" : String.join("\n\n---\n\n", chunks);
      String history = buildHistoryContext(getChatHistory(chatId));

      String prompt = """
                Ты — ИТ-архитектор. Отвечай на русском языке.
                %s
                %s
                ВОПРОС: %s
                ОТВЕТ:
                """.formatted(
          context.isEmpty() ? "" : "ЗНАНИЯ:\n" + context,
          history.isEmpty() ? "" : history,
          question
      );

      ChatClient client = ChatClient.builder(chatModel).build();
      return client.prompt().user(prompt).stream().content();
    } catch (Exception e) {
      log.error("AI ошибка: {}", e.getMessage(), e);
      return Flux.just("Ошибка: " + e.getMessage());
    }
  }

  public Flux<String> validateStream(String solution, UUID chatId) {
    return validateStream(solution, chatId, "Текст пользователя");
  }

  private Flux<String> validateStream(String solution, UUID chatId, String sourceName) {
    try {
      String rawSolution = solution == null ? "" : solution;
      String validationSourceName = sourceName == null || sourceName.isBlank() ? "Текст пользователя" : sourceName.trim();
      String preparedSolution = prepareSolutionForValidation(rawSolution);
      String searchQuery = rawSolution.length() > 1000 ? rawSolution.substring(0, 1000) : rawSolution;
      List<String> criteriaChunks = searchService.findRelevantChunks(VALIDATION_SEARCH_PREFIX + "\n" + searchQuery, VALIDATION_TOP_K);
      String criteriaContext = criteriaChunks.isEmpty()
          ? "Стандарты не найдены."
          : criteriaChunks.stream()
              .map(chunk -> limitText(chunk, MAX_CONTEXT_CHUNK_CHARS))
              .collect(Collectors.joining("\n\n---\n\n"));
      String cacheKey = validationCacheKey(rawSolution, criteriaContext);
      String cachedReport = validationReportCache.get(cacheKey);
      if (cachedReport != null) {
        return Flux.just(cachedReport);
      }

      String prompt = """
          /no_think
          Ты — быстрый аудитор ИТ-архитектуры. Проверь решение по стандартам.
          Всегда отвечай только на русском языке, даже если стандарты или документ на английском.
          Не используй английские заголовки Issue / Violation / Recommendation.
          Не используй историю чата. Не выводи рассуждения и <think>.
          Пиши кратко. Максимум 8 нарушений и 8 пройденных проверок.
          Для каждого нарушения обязательно укажи Файл, Пункт документа, Severity, Описание, Рекомендация.
          Для каждой пройденной проверки обязательно укажи Файл, Пункт документа и Обоснование.
          В "Пройденные проверки" перечисляй только реально найденные соответствия. Не пиши "отсутствует, но не проверялось".
          Если точный пункт документа не найден, пиши "Пункт документа: Не указан".
          Коды нарушений: OA, TG, AR, SID, SEC, DATA, INFRA, DEVOPS, INT.
          Severity сортируй так: CRITICAL, HIGH, MEDIUM, LOW, INFO.
          Общий статус FAILED, если есть HIGH или CRITICAL.
          Не придумывай факты: опирайся только на СТАНДАРТЫ и РЕШЕНИЕ.

          Дата проверки: %s
          Файл проверки: %s

          ФОРМАТ ОТЧЁТА:
          %s

          СТАНДАРТЫ:
          %s

          РЕШЕНИЕ:
          %s

          Начни строго с "# Architecture Compliance Validation Report".
          """.formatted(
          LocalDate.now(),
          validationSourceName,
          FAST_VALIDATION_REPORT_FORMAT,
          criteriaContext,
          preparedSolution
      );

      ChatClient client = ChatClient.builder(chatModel).build();
      StringBuilder streamedReport = new StringBuilder();
      return client.prompt()
          .user(prompt)
          .stream()
          .content()
          .doOnNext(streamedReport::append)
          .doOnComplete(() -> cacheValidationReport(cacheKey, streamedReport.toString()));
    } catch (Exception e) {
      log.error("Ошибка проверки: {}", e.getMessage(), e);
      return Flux.just("Ошибка проверки: " + e.getMessage());
    }
  }

  public Flux<String> validateDocumentStream(UUID documentId, String additionalComment, UUID chatId) {
    try {
      Document doc = documentRepository.findById(documentId)
          .orElseThrow(() -> new RuntimeException("Документ не найден"));
      String solutionText = doc.getExtractedText();
      String comment = additionalComment == null || additionalComment.isBlank()
          ? ""
          : "\n\nКомментарий пользователя:\n" + additionalComment.trim();
      String fullSolution = solutionText + comment;
      return validateStream(fullSolution, chatId, doc.getFileName());
    } catch (Exception e) {
      log.error("Ошибка при валидации документа: {}", e.getMessage(), e);
      return Flux.just("Ошибка при чтении документа: " + e.getMessage());
    }
  }

  public Flux<String> businessSolutionStream(String input, UUID chatId) {
    try {
      // Определяем, является ли вход файлом или текстом
      String userInput = input;

      // Поиск релевантных знаний из базы
      String searchQuery = input.length() > 1000 ? input.substring(0, 1000) : input;
      List<String> chunks = searchService.findRelevantChunks(searchQuery, TOP_K);
      String context = chunks.isEmpty() ? "" : String.join("\n\n---\n\n", chunks);
      String history = buildHistoryContext(getChatHistory(chatId));

      // Промпт для генерации бизнес-решения
      String prompt = """
            Ты — архитектор бизнес-решений и ИТ-стратег. Твоя задача — разработать комплексное бизнес-решение на основе запроса пользователя.
            
            %s
            %s
            
            ## ЗАПРОС ПОЛЬЗОВАТЕЛЯ:
            %s
            
            ## ТРЕБОВАНИЯ К ОТВЕТУ:
            1. **Бизнес-контекст** — опишите проблему/задачу с точки зрения бизнеса
            2. **Цели и KPI** — какие метрики успеха, как измерять результат
            3. **Архитектурное решение** — компоненты, интеграции, технологии
            4. **Дорожная карта** — этапы внедрения, сроки, приоритеты
            5. **Риски и их mitigation** — какие риски и как их минимизировать
            6. **Бюджетная оценка** — примерные затраты (лицензии, разработка, поддержка)
            
            Ответ должен быть на русском языке, структурированным, практичным и применимым к реальному бизнесу.
            Используй Markdown для форматирования.
            
            ## ОТВЕТ (Бизнес-решение):
            """.formatted(
          context.isEmpty() ? "" : "## БАЗА ЗНАНИЙ (релевантные стандарты и практики):\n" + context,
          history.isEmpty() ? "" : "## ИСТОРИЯ ДИАЛОГА:\n" + history,
          userInput
      );

      ChatClient client = ChatClient.builder(chatModel).build();
      return client.prompt().user(prompt).stream().content();

    } catch (Exception e) {
      log.error("Ошибка генерации бизнес-решения: {}", e.getMessage(), e);
      return Flux.just("❌ Ошибка при генерации бизнес-решения: " + e.getMessage());
    }
  }
}
