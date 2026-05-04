package com.ertekom.archassistant.service.ai;

import com.ertekom.archassistant.domain.entity.Document;
import com.ertekom.archassistant.repository.DocumentRepository;
import com.ertekom.archassistant.service.learning.KnowledgeSearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SimpleAIService {

    private final OllamaChatModel chatModel;
    private final KnowledgeSearchService searchService;
    private final DocumentRepository documentRepository;
    private final JdbcTemplate jdbcTemplate;

    private static final int TOP_K = 5;

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
        try {
            String searchQuery = solution.length() > 1000 ? solution.substring(0, 1000) : solution;
            List<String> criteriaChunks = searchService.findRelevantChunks("архитектурные стандарты " + searchQuery, TOP_K);
            String criteriaContext = criteriaChunks.isEmpty() ? "Стандарты не найдены." : String.join("\n\n---\n\n", criteriaChunks);
            String history = buildHistoryContext(getChatHistory(chatId));

            String prompt = """
                Ты — эксперт-аудитор ИТ-архитектуры. Проверь решение на соответствие стандартам.
                %s
                СТАНДАРТЫ:
                %s
                РЕШЕНИЕ:
                %s
                Выведи отчёт в Markdown: итог, нарушения, рекомендации, позитив, оценка зрелости.
                """.formatted(
                    history.isEmpty() ? "" : "ИСТОРИЯ ДИАЛОГА:\n" + history,
                    criteriaContext,
                    solution
            );

            ChatClient client = ChatClient.builder(chatModel).build();
            return client.prompt().user(prompt).stream().content();
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
            String fullSolution = solutionText + "\n\nКомментарий: " + additionalComment;
            return validateStream(fullSolution, chatId);
        } catch (Exception e) {
            log.error("Ошибка при валидации документа: {}", e.getMessage(), e);
            return Flux.just("Ошибка при чтении документа: " + e.getMessage());
        }
    }
}