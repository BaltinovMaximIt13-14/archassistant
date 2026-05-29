package com.ertekom.archassistant.service.ai;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.LinkedHashMap;
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
  ObjectMapper objectMapper;
  ConcurrentMap<String, String> validationReportCache = new ConcurrentHashMap<>();

  public static final String STREAM_END_TOKEN = "[[ARCHASSISTANT_STREAM_END]]";
  private static final int TOP_K = 5;
  private static final int VALIDATION_TOP_K = 6;
  private static final int VALIDATION_CACHE_LIMIT = 100;
  private static final int MAX_VALIDATION_SOLUTION_CHARS = 30_000;
  private static final int MAX_CONTEXT_CHUNK_CHARS = 1_400;
  private static final int MAX_BUSINESS_INPUT_CHARS = 30_000;
  private static final int MAX_PANEL_SOURCE_CHARS = 35_000;
  private static final String VALIDATION_PROMPT_VERSION = "validation-v4";
  private static final String VALIDATION_SEARCH_PREFIX = """
      Архитектура ИТ-систем безопасность данные интеграция API эксплуатация надежность масштабируемость
      """;
  private static final String VALIDATION_REPORT_FORMAT = """
      # Отчёт проверки архитектурного решения

      ## 1. Паспорт проверки
      | Поле | Значение |
      |---|---|
      | Идентификатор проверки | VAL-YYYYMMDD-XXX |
      | Дата проверки | YYYY-MM-DD |
      | Проверяемый документ | фактическое имя файла |
      | Общий статус | PASSED / PARTIALLY PASSED / FAILED |
      | Общий уровень зрелости | N/100 |

      ## 2. Executive Summary
      Краткое итоговое резюме: 2-4 абзаца с ключевыми выводами, рисками и приоритетами исправлений.

      ## 3. Нарушения
      1. OA-001: Короткий заголовок нарушения
         Файл: фактическое имя файла
         Пункт документа: конкретный раздел, подпункт или фрагмент цитаты
         Severity: CRITICAL / HIGH / MEDIUM / LOW / INFO
         Стандарт: название контрольного правила/методики (если применимо)
         Описание: что именно нарушено и почему
         Почему это важно: последствия для бизнеса, архитектуры, эксплуатации или безопасности
         Рекомендация: конкретное исправление

      ## 4. Замечания
      1. RM-001: Короткий заголовок замечания
         Файл: фактическое имя файла
         Пункт документа: конкретный раздел, подпункт или фрагмент цитаты
         Severity: MEDIUM / LOW / INFO
         Стандарт: название контрольного правила/методики (если применимо)
         Описание замечания: что стоит доработать
         Влияние: к чему приведёт, если не исправить
         Рекомендация: как улучшить

      ## 5. Пройденные тесты
      1. П-001: Что соответствует требованиям
         Файл: фактическое имя файла
         Пункт документа: конкретный раздел, подпункт или фрагмент цитаты
         Стандарт: название контрольного правила/методики (если применимо)
         Что проверялось: какое требование или критерий
         Что обнаружено: факт соответствия из решения
         Результат: PASSED

      ## 6. Матрица контрольных областей
      | Область | Статус | Комментарий |
      |---|---|---|
      | Бизнес-архитектура | PASSED / PARTIALLY PASSED / FAILED | развёрнутый комментарий |
      | Прикладная архитектура | PASSED / PARTIALLY PASSED / FAILED | развёрнутый комментарий |
      | Данные | PASSED / PARTIALLY PASSED / FAILED | развёрнутый комментарий |
      | Технологии | PASSED / PARTIALLY PASSED / FAILED | развёрнутый комментарий |
      | Безопасность | PASSED / PARTIALLY PASSED / FAILED | развёрнутый комментарий |
      | Интеграция | PASSED / PARTIALLY PASSED / FAILED | развёрнутый комментарий |
      | DevOps/Эксплуатация | PASSED / PARTIALLY PASSED / FAILED | развёрнутый комментарий |

      ## 7. Анализ бизнес-архитектуры
      Детальный анализ целей, процессов, ролей, KPI, gap-анализ.

      ## 8. Анализ прикладной архитектуры
      Детальный анализ сервисов, API, интеграций, связности и независимости.

      ## 9. Анализ данных
      Детальный анализ доменов данных, моделей, качества данных, владения данными.

      ## 10. Анализ технологий
      Детальный анализ стека, устаревших технологий, масштабируемости и поддерживаемости.

      ## 11. Анализ безопасности
      Детальный анализ аутентификации, авторизации, шифрования, аудита и уязвимостей.

      ## 12. Архитектурные риски
      Список рисков с вероятностью, влиянием и приоритетом.

      ## 13. Рекомендации и план исправления
      Приоритет 1 (критично), Приоритет 2 (важно), Приоритет 3 (улучшения),
      с ответственными ролями и ориентировочными сроками.

      ## 14. Оценка зрелости и финальное заключение
      Оценка по направлениям (Business, Application, Data, Technology, Security, Governance),
      общий вывод и условия согласования.

      ## 15. Machine Readable Summary
      {"overallScore":0,"status":"PASSED|PARTIALLY PASSED|FAILED","criticalViolations":0,"highViolations":0,"remarks":0,"passedTests":0,"domains":{"business":0,"application":0,"data":0,"technology":0,"security":0,"governance":0,"integration":0,"devops":0}}
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

  public String streamEndToken() {
    return STREAM_END_TOKEN;
  }

  private String extractJsonObject(String raw) {
    if (raw == null || raw.isBlank()) return "";
    String cleaned = raw.trim()
        .replace("```json", "")
        .replace("```", "")
        .trim();

    int first = cleaned.indexOf('{');
    if (first < 0) return "";

    int depth = 0;
    boolean inString = false;
    boolean escaped = false;
    for (int i = first; i < cleaned.length(); i++) {
      char ch = cleaned.charAt(i);
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch == '\\') {
          escaped = true;
        } else if (ch == '"') {
          inString = false;
        }
        continue;
      }

      if (ch == '"') {
        inString = true;
        continue;
      }
      if (ch == '{') depth++;
      if (ch == '}') {
        depth--;
        if (depth == 0) {
          return cleaned.substring(first, i + 1);
        }
      }
    }

    return "";
  }

  private Map<String, Object> emptyValidationPanel(String sourceName) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("sourceFile", resolveSourceName(sourceName));
    payload.put("maturity", Map.of("overall", "", "description", ""));
    payload.put("violations", new ArrayList<>());
    payload.put("remarks", new ArrayList<>());
    payload.put("passedTests", new ArrayList<>());
    return payload;
  }

  private Map<String, Object> normalizeValidationPanel(Map<String, Object> panel, String sourceName) {
    Map<String, Object> normalized = new LinkedHashMap<>();
    normalized.put("sourceFile", panel.getOrDefault("sourceFile", resolveSourceName(sourceName)));
    normalized.put("maturity", panel.getOrDefault("maturity", Map.of("overall", "", "description", "")));
    normalized.put("violations", panel.getOrDefault("violations", new ArrayList<>()));
    normalized.put("remarks", panel.getOrDefault("remarks", new ArrayList<>()));
    normalized.put("passedTests", panel.getOrDefault("passedTests", new ArrayList<>()));
    return normalized;
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
          Для каждого нарушения обязательно укажи Файл, Пункт документа, Severity, Стандарт, Описание, Почему это важно, Рекомендация.
          Для каждого замечания обязательно укажи Файл, Пункт документа, Severity, Стандарт, Описание замечания, Влияние, Рекомендация.
          Для каждого пройденного теста обязательно укажи Файл, Пункт документа, Стандарт, Что проверялось, Что обнаружено, Результат.
          В "Пройденные тесты" перечисляй только реально найденные соответствия. Не пиши "отсутствует, но не проверялось".
          В поле "Файл" всегда указывай фактическое имя проверяемого документа: "%s".
          В поле "Пункт документа" всегда указывай конкретный раздел, подпункт или короткую цитату (формат: Фрагмент: "...").
          Строго запрещено использовать заглушки и шаблонные маркеры: "Не указан", "Не указано", "Проверяемый документ", "N/A", "<...>".
          Коды нарушений: OA, TG, AR, SID, SEC, DATA, INFRA, DEVOPS, INT. Коды замечаний: RM-001, RM-002...
          Severity сортируй так: CRITICAL, HIGH, MEDIUM, LOW, INFO.
          Общий статус FAILED, если есть HIGH или CRITICAL.
          Всегда укажи "Общий уровень зрелости: N/100", даже если оценка приблизительная.
          Не создавай отдельные пункты с заголовком "Критика". Критику объединяй с соответствующим нарушением в поле "Почему это важно".
          Не придумывай факты: опирайся только на КОНТЕКСТ ПРОВЕРКИ и РЕШЕНИЕ.
          Если фактов недостаточно, явно укажи, каких именно данных не хватает, и почему это ограничивает вывод.

          Дата проверки: %s
          Файл проверки: %s

          ФОРМАТ ОТЧЁТА:
          %s

          КОНТЕКСТ ПРОВЕРКИ:
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

  public Map<String, Object> generateValidationPanel(String validationReport, String sourceName) {
    try {
      String source = resolveSourceName(sourceName);
      String report = validationReport == null ? "" : validationReport.trim();
      if (report.isBlank()) {
        return emptyValidationPanel(source);
      }

      String truncatedReport = report.length() > MAX_PANEL_SOURCE_CHARS
          ? report.substring(0, MAX_PANEL_SOURCE_CHARS)
          : report;

      String prompt = """
          /no_think
          Ты — ИТ-аудитор. На основе готового отчёта сформируй данные для правой панели интерфейса.
          Верни только JSON-объект без markdown, без комментариев, без пояснений.
          Не придумывай факты: используй только данные из отчёта.
          Не используй заглушки ("Не указано", "N/A", "<...>", "Проверяемый документ").
          Обязательно сформируй 3 массива:
          1) violations — только нарушения уровня CRITICAL/HIGH.
          2) remarks — замечания уровня MEDIUM/LOW/INFO и организационные недочёты.
          3) passedTests — только реальные пройденные тесты.
          Запрещено создавать отдельные карточки с заголовком "Критика".
          Если в отчёте есть пара "Проблема + Критика", объедини их в одну запись:
          - title возьми из проблемы;
          - whyImportant (или impact) заполни содержанием критики/последствий.

          Структура JSON:
          {
            "sourceFile": "string",
            "maturity": {"overall":"N/100","description":"string"},
            "violations": [
              {"code":"OA-001","severity":"HIGH","title":"string","standard":"string","problemDescription":"string","whyImportant":"string","recommendation":"string"}
            ],
            "remarks": [
              {"code":"RM-001","severity":"MEDIUM","title":"string","standard":"string","remarkDescription":"string","impact":"string","recommendation":"string"}
            ],
            "passedTests": [
              {"code":"P-001","title":"string","standard":"string","whatChecked":"string","whatFound":"string","result":"string"}
            ]
          }

          Проверяемый документ: %s
          ОТЧЁТ:
          %s
          """.formatted(source, truncatedReport);

      ChatClient client = ChatClient.builder(chatModel).build();
      String raw = client.prompt().user(prompt).call().content();
      String json = extractJsonObject(raw);
      if (json.isBlank()) {
        log.warn("Не удалось извлечь JSON панели из ответа модели.");
        return emptyValidationPanel(source);
      }

      Map<String, Object> parsed = objectMapper.readValue(json, new TypeReference<>() {});
      return normalizeValidationPanel(parsed, source);
    } catch (Exception e) {
      log.error("Ошибка генерации панели проверки: {}", e.getMessage(), e);
      return emptyValidationPanel(sourceName);
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
