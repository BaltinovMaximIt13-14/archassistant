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
  private static final int VALIDATION_TOP_K = 6;
  private static final int VALIDATION_CACHE_LIMIT = 100;
  private static final int MAX_VALIDATION_SOLUTION_CHARS = 25_000;
  private static final int MAX_CONTEXT_CHUNK_CHARS = 1_400;
  private static final int MAX_BUSINESS_INPUT_CHARS = 30_000;
  private static final String VALIDATION_PROMPT_VERSION = "validation-v3";
  private static final String VALIDATION_SEARCH_PREFIX = """
      OpenAPI TOGAF ArchiMate TM Forum SID Security Data Integration DevOps Infrastructure
      """;
  private static final String VALIDATION_REPORT_FORMAT = """
      # Отчёт проверки архитектурного решения

      ## 1. Паспорт проверки
      | Поле | Значение |
      |---|---|
      | Идентификатор проверки | VAL-YYYYMMDD-XXX |
      | Дата проверки | YYYY-MM-DD |
      | Проверяемый документ | фактическое имя файла |
      | Набор стандартов | TOGAF, ArchiMate, OpenAPI, TM Forum SID, Security, Data, Integration, DevOps |
      | Общий статус | PASSED / PARTIALLY PASSED / FAILED |
      | Общий уровень зрелости | N/100 |

      ## 2. Executive Summary
      Краткое итоговое резюме: 2-4 абзаца с ключевыми выводами, рисками и приоритетами исправлений.

      ## 3. Нарушения
      1. OA-001: Короткий заголовок нарушения
         Файл: фактическое имя файла
         Пункт документа: конкретный раздел, подпункт или фрагмент цитаты
         Severity: CRITICAL / HIGH / MEDIUM / LOW / INFO
         Описание: что именно нарушено и почему
         Доказательства: цитата/фрагмент из решения
         Риск: влияние на бизнес и/или эксплуатацию
         Рекомендация: конкретное исправление

      ## 4. Пройденные проверки
      1. П-001: Что соответствует требованиям
         Файл: фактическое имя файла
         Пункт документа: конкретный раздел, подпункт или фрагмент цитаты
         Обоснование: факт соответствия из решения
         Доказательства: цитата/фрагмент из решения

      ## 5. Матрица соответствия стандартам
      | Стандарт | Статус | Комментарий |
      |---|---|---|
      | TOGAF | PASSED / PARTIALLY PASSED / FAILED | развёрнутый комментарий |
      | ArchiMate | PASSED / PARTIALLY PASSED / FAILED | развёрнутый комментарий |
      | OpenAPI | PASSED / PARTIALLY PASSED / FAILED | развёрнутый комментарий |
      | TMF SID | PASSED / PARTIALLY PASSED / FAILED | развёрнутый комментарий |
      | Security | PASSED / PARTIALLY PASSED / FAILED | развёрнутый комментарий |
      | Data | PASSED / PARTIALLY PASSED / FAILED | развёрнутый комментарий |
      | Integration | PASSED / PARTIALLY PASSED / FAILED | развёрнутый комментарий |
      | DevOps | PASSED / PARTIALLY PASSED / FAILED | развёрнутый комментарий |

      ## 6. Анализ бизнес-архитектуры
      Детальный анализ целей, процессов, ролей, KPI, gap-анализ.

      ## 7. Анализ прикладной архитектуры
      Детальный анализ сервисов, API, интеграций, связности и независимости.

      ## 8. Анализ данных
      Детальный анализ доменов данных, моделей, качества данных, владения данными.

      ## 9. Анализ технологий
      Детальный анализ стека, устаревших технологий, масштабируемости и поддерживаемости.

      ## 10. Анализ безопасности
      Детальный анализ аутентификации, авторизации, шифрования, аудита и уязвимостей.

      ## 11. Архитектурные риски
      Список рисков с вероятностью, влиянием и приоритетом.

      ## 12. Рекомендации и план исправления
      Приоритет 1 (критично), Приоритет 2 (важно), Приоритет 3 (улучшения),
      с ответственными ролями и ориентировочными сроками.

      ## 13. Оценка зрелости и финальное заключение
      Оценка по направлениям (Business, Application, Data, Technology, Security, Governance),
      общий вывод и условия согласования.

      ## 14. Machine Readable Summary
      {"overallScore":0,"status":"PASSED|PARTIALLY PASSED|FAILED","criticalViolations":0,"highViolations":0,"mediumViolations":0,"lowViolations":0,"passedChecks":0,"failedChecks":0,"domains":{"business":0,"application":0,"data":0,"technology":0,"security":0,"governance":0,"integration":0,"devops":0}}
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

  private String validationCacheKey(String solution, String criteriaContext, String sourceName) {
    return sha256(VALIDATION_PROMPT_VERSION + "\n---SOURCE---\n" + sourceName + "\n---CRITERIA---\n" + criteriaContext + "\n---SOLUTION---\n" + solution);
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

  private String resolveSourceName(String sourceName) {
    if (sourceName == null || sourceName.isBlank()) return "Входной текст пользователя";
    return sourceName.trim();
  }

  private String prepareBusinessInput(String input) {
    if (input == null) return "";
    if (input.length() <= MAX_BUSINESS_INPUT_CHARS) return input;
    int headSize = MAX_BUSINESS_INPUT_CHARS * 2 / 3;
    int tailSize = MAX_BUSINESS_INPUT_CHARS - headSize;
    return input.substring(0, headSize)
        + "\n\n...[середина исходного материала сокращена для стабильной генерации]...\n\n"
        + input.substring(input.length() - tailSize);
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
    return validateStream(solution, chatId, "Входной текст пользователя");
  }

  private Flux<String> validateStream(String solution, UUID chatId, String sourceName) {
    try {
      String rawSolution = solution == null ? "" : solution;
      String validationSourceName = resolveSourceName(sourceName);
      String preparedSolution = prepareSolutionForValidation(rawSolution);
      String searchQuery = rawSolution.length() > 1000 ? rawSolution.substring(0, 1000) : rawSolution;
      List<String> criteriaChunks = searchService.findRelevantChunks(VALIDATION_SEARCH_PREFIX + "\n" + searchQuery, VALIDATION_TOP_K);
      String criteriaContext = criteriaChunks.isEmpty()
          ? "Стандарты не найдены."
          : criteriaChunks.stream()
              .map(chunk -> limitText(chunk, MAX_CONTEXT_CHUNK_CHARS))
              .collect(Collectors.joining("\n\n---\n\n"));
      String cacheKey = validationCacheKey(rawSolution, criteriaContext, validationSourceName);
      String cachedReport = validationReportCache.get(cacheKey);
      if (cachedReport != null) {
        return Flux.just(cachedReport);
      }

      String prompt = """
          /no_think
          Ты — ведущий аудитор ИТ-архитектуры. Подготовь подробный и профессиональный отчёт проверки решения по стандартам.
          Всегда отвечай только на русском языке, даже если стандарты или документ на английском.
          Не используй английские заголовки Issue / Violation / Recommendation.
          Не используй историю чата. Не выводи рассуждения и <think>.
          Не сокращай ответ искусственно: отчёт должен быть объёмным и содержательным.
          Для каждого нарушения обязательно укажи Файл, Пункт документа, Severity, Описание, Доказательства, Риск, Рекомендация.
          Для каждой пройденной проверки обязательно укажи Файл, Пункт документа, Обоснование и Доказательства.
          В "Пройденные проверки" перечисляй только реально найденные соответствия. Не пиши "отсутствует, но не проверялось".
          В поле "Файл" всегда указывай фактическое имя проверяемого документа: "%s".
          В поле "Пункт документа" всегда указывай конкретный раздел, подпункт или короткую цитату (формат: Фрагмент: "...").
          Строго запрещено использовать заглушки и шаблонные маркеры: "Не указан", "Не указано", "Проверяемый документ", "N/A", "<...>".
          Коды нарушений: OA, TG, AR, SID, SEC, DATA, INFRA, DEVOPS, INT.
          Severity сортируй так: CRITICAL, HIGH, MEDIUM, LOW, INFO.
          Общий статус FAILED, если есть HIGH или CRITICAL.
          Не придумывай факты: опирайся только на СТАНДАРТЫ и РЕШЕНИЕ.
          Если фактов недостаточно, явно укажи, каких именно данных не хватает, и почему это ограничивает вывод.

          Дата проверки: %s
          Файл проверки: %s

          ФОРМАТ ОТЧЁТА:
          %s

          СТАНДАРТЫ:
          %s

          РЕШЕНИЕ:
          %s

          Начни строго с "# Отчёт проверки архитектурного решения".
          """.formatted(
          validationSourceName,
          LocalDate.now(),
          validationSourceName,
          VALIDATION_REPORT_FORMAT,
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

  public Flux<String> businessSolutionDocumentStream(UUID documentId, String additionalComment, UUID chatId) {
    try {
      Document doc = documentRepository.findById(documentId)
          .orElseThrow(() -> new RuntimeException("Документ не найден"));
      String documentText = doc.getExtractedText() == null ? "" : doc.getExtractedText();
      String trimmedComment = additionalComment == null ? "" : additionalComment.trim();

      StringBuilder input = new StringBuilder();
      input.append("Исходный материал из документа \"")
          .append(doc.getFileName())
          .append("\".\n\n")
          .append(documentText);

      if (!trimmedComment.isBlank()) {
        input.append("\n\nКомментарий пользователя:\n")
            .append(trimmedComment);
      }

      return businessSolutionStream(input.toString(), chatId);
    } catch (Exception e) {
      log.error("Ошибка генерации бизнес-решения по документу: {}", e.getMessage(), e);
      return Flux.just("Ошибка при чтении документа: " + e.getMessage());
    }
  }

  public Flux<String> businessSolutionStream(String input, UUID chatId) {
    try {
      // Определяем, является ли вход файлом или текстом
      String userInput = prepareBusinessInput(input == null ? "" : input);

      // Поиск релевантных знаний из базы
      String searchQuery = userInput.length() > 1000 ? userInput.substring(0, 1000) : userInput;
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
            Не используй заглушки вида "Не указано", "N/A", "<...>".
            Если каких-то данных в исходнике нет, фиксируй это как ограничение и давай практичную гипотезу с пометкой "гипотеза".
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
