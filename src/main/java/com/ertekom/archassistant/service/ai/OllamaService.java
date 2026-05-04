package com.ertekom.archassistant.service.ai;

import com.ertekom.archassistant.repository.DocumentChunkRepository;
import com.ertekom.archassistant.repository.KnowledgeContentRepository;
import com.ertekom.archassistant.repository.VectorStoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OllamaService {

    private final OllamaChatModel chatModel;
    private final EmbeddingModel embeddingModel;
    private final VectorStore vectorStore;
    private final KnowledgeContentRepository knowledgeContentRepository;
    private final DocumentChunkRepository documentChunkRepository;
    private final VectorStoreRepository vectorStoreRepository;
    private final JdbcTemplate jdbcTemplate;

    @Value("${spring.ai.ollama.chat.model:llama3.2}")
    private String chatModelName;

    @Value("${spring.ai.ollama.embedding.model:nomic-embed-text}")
    private String embeddingModelName;

    private static final int TOP_K_KNOWLEDGE = 7;
    private static final int TOP_K_DOCUMENTS = 5;
    private static final int MAX_CONTEXT_LENGTH = 8000;

    /**
     * Генерация решения на основе бизнес-задачи и контекста чата
     */
    public String generateSolution(String businessTask, UUID chatId) {
        try {
            // 1. Поиск релевантных чанков в базе знаний (архитектурные стандарты)
            List<Map<String, Object>> knowledgeChunks = searchKnowledgeBase(businessTask);

            // 2. Поиск релевантных чанков в документах пользователя (если есть chatId)
            List<Map<String, Object>> userDocumentChunks = new ArrayList<>();
            if (chatId != null) {
                userDocumentChunks = searchUserDocuments(businessTask, chatId);
            }

            // 3. Получение истории чата (последние 5 сообщений)
            List<Map<String, String>> chatHistory = getChatHistory(chatId);

            // 4. Формирование контекста
            String context = buildContext(knowledgeChunks, userDocumentChunks);
            String historyContext = buildHistoryContext(chatHistory);

            // 5. Сборка промпта
            String prompt = buildPrompt(businessTask, context, historyContext);

            // 6. Вызов LLM
            String solution = callLLM(prompt);

            // 7. Сохраняем решение в векторную БД для будущего использования (опционально)
            if (solution != null && !solution.isEmpty() && chatId != null) {
                saveSolutionToVectorStore(solution, businessTask, chatId);
            }

            return solution;

        } catch (Exception e) {
            e.printStackTrace();
            return "Ошибка генерации решения: " + e.getMessage();
        }
    }

    /**
     * Проверка решения на соответствие стандартам
     */
    public String validateSolution(String solutionText) {
        try {
            // 1. Извлекаем ключевые концепции из решения
            String keyConcepts = extractKeyConcepts(solutionText);

            // 2. Поиск релевантных стандартов
            List<Map<String, Object>> relevantStandards = searchKnowledgeBase(keyConcepts);

            // 3. Формирование промпта для проверки
            String standardsContext = formatStandardsContext(relevantStandards);

            String prompt = buildValidationPrompt(solutionText, standardsContext);

            // 4. Вызов LLM
            return callLLM(prompt);

        } catch (Exception e) {
            e.printStackTrace();
            return "Ошибка проверки решения: " + e.getMessage();
        }
    }

    /**
     * Поиск в базе знаний через векторное сходство
     */
    private List<Map<String, Object>> searchKnowledgeBase(String query) {
        try {
            // Получаем эмбеддинг запроса
            float[] queryEmbedding = embeddingModel.embed(query);

            // Поиск через native query для лучшего контроля
            String sql = """
                SELECT 
                    vs.id,
                    vs.content,
                    vs.metadata,
                    1 - (vs.embedding <=> ?::vector) as similarity
                FROM vector_store vs
                WHERE vs.metadata->>'type' = 'KNOWLEDGE_BASE'
                ORDER BY vs.embedding <=> ?::vector
                LIMIT ?
                """;

            String embeddingStr = arrayToPgVectorString(queryEmbedding);
            List<Map<String, Object>> results = jdbcTemplate.queryForList(sql, embeddingStr, embeddingStr, TOP_K_KNOWLEDGE);

            // Если результаты не найдены, пробуем через Spring AI
            if (results.isEmpty()) {
                SearchRequest searchRequest = SearchRequest.builder()
                        .query(query)
                        .topK(TOP_K_KNOWLEDGE)
                        .similarityThreshold(0.5)
                        .build();
                var documents = vectorStore.similaritySearch(searchRequest);

                for (var doc : documents) {
                    Map<String, Object> result = new HashMap<>();
                    result.put("content", doc.getText());
                    result.put("metadata", doc.getMetadata());
                    result.put("similarity", 0.7);
                    results.add(result);
                }
            }

            return results;

        } catch (Exception e) {
            System.err.println("Error searching knowledge base: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    /**
     * Поиск в документах пользователя
     */
    private List<Map<String, Object>> searchUserDocuments(String query, UUID chatId) {
        try {
            float[] queryEmbedding = embeddingModel.embed(query);
            String embeddingStr = arrayToPgVectorString(queryEmbedding);

            String sql = """
                SELECT 
                    vs.id,
                    vs.content,
                    vs.metadata,
                    1 - (vs.embedding <=> ?::vector) as similarity
                FROM vector_store vs
                WHERE vs.metadata->>'type' = 'USER_DOCUMENT'
                    AND vs.metadata->>'chatId' = ?
                ORDER BY vs.embedding <=> ?::vector
                LIMIT ?
                """;

            return jdbcTemplate.queryForList(sql, embeddingStr, chatId.toString(), embeddingStr, TOP_K_DOCUMENTS);

        } catch (Exception e) {
            System.err.println("Error searching user documents: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    /**
     * Получение истории чата
     */
    private List<Map<String, String>> getChatHistory(UUID chatId) {
        if (chatId == null) return new ArrayList<>();

        try {
            String sql = """
                SELECT role, content, created_at 
                FROM messages 
                WHERE chat_id = ? 
                ORDER BY created_at DESC 
                LIMIT 10
                """;

            List<Map<String, Object>> results = jdbcTemplate.queryForList(sql, chatId);

            // Переворачиваем для хронологического порядка
            Collections.reverse(results);

            return results.stream()
                    .map(row -> {
                        Map<String, String> msg = new HashMap<>();
                        msg.put("role", (String) row.get("role"));
                        msg.put("content", (String) row.get("content"));
                        return msg;
                    })
                    .collect(Collectors.toList());

        } catch (Exception e) {
            System.err.println("Error getting chat history: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    /**
     * Формирование контекста из найденных чанков
     */
    private String buildContext(List<Map<String, Object>> knowledgeChunks,
                                List<Map<String, Object>> userChunks) {
        StringBuilder context = new StringBuilder();

        // Архитектурные стандарты
        if (!knowledgeChunks.isEmpty()) {
            context.append("## АРХИТЕКТУРНЫЕ СТАНДАРТЫ (из базы знаний)\n\n");
            for (int i = 0; i < knowledgeChunks.size(); i++) {
                Map<String, Object> chunk = knowledgeChunks.get(i);
                String content = (String) chunk.get("content");
                Map<String, Object> metadata = (Map<String, Object>) chunk.get("metadata");
                String sourceName = metadata != null ? (String) metadata.getOrDefault("fileName", "unknown") : "unknown";
                Double similarity = (Double) chunk.get("similarity");

                context.append(String.format("**Источник %d:** %s (релевантность: %.2f)\n",
                        i + 1, sourceName, similarity != null ? similarity : 0.7));
                context.append(truncateContent(content, 1500)).append("\n\n");
                context.append("---\n\n");
            }
        } else {
            context.append("## АРХИТЕКТУРНЫЕ СТАНДАРТЫ\n*Не найдено релевантных стандартов*\n\n");
        }

        // Пользовательские документы
        if (!userChunks.isEmpty()) {
            context.append("## ДОКУМЕНТЫ ПОЛЬЗОВАТЕЛЯ (из текущего чата)\n\n");
            for (int i = 0; i < userChunks.size(); i++) {
                Map<String, Object> chunk = userChunks.get(i);
                String content = (String) chunk.get("content");
                Map<String, Object> metadata = (Map<String, Object>) chunk.get("metadata");
                String fileName = metadata != null ? (String) metadata.getOrDefault("fileName", "unknown") : "unknown";

                context.append(String.format("**Файл %d:** %s\n", i + 1, fileName));
                context.append(truncateContent(content, 800)).append("\n\n");
                context.append("---\n\n");
            }
        }

        return context.toString();
    }

    /**
     * Формирование контекста из истории чата
     */
    private String buildHistoryContext(List<Map<String, String>> chatHistory) {
        if (chatHistory.isEmpty()) return "";

        StringBuilder history = new StringBuilder();
        history.append("## ИСТОРИЯ ДИАЛОГА\n\n");

        for (Map<String, String> msg : chatHistory) {
            String role = msg.get("role");
            String content = msg.get("content");
            String prefix = "user".equals(role) ? "👤 Пользователь" : "🤖 Ассистент";
            history.append(String.format("**%s:** %s\n\n", prefix, truncateContent(content, 500)));
        }

        return history.toString();
    }

    /**
     * Формирование промпта для генерации
     */
    private String buildPrompt(String task, String context, String historyContext) {
        return """
            Ты — профессиональный ИТ-архитектор с большим опытом в разработке корпоративных решений.
            
            Ответь на русском языке, используй профессиональную терминологию, но будь понятен.
            """.formatted(context, historyContext, task);
    }

    /**
     * Формирование промпта для проверки
     */
    private String buildValidationPrompt(String solution, String standardsContext) {
        return """
            Ты — эксперт по ИТ-архитектуре. Проверь представленный проект решения на соответствие архитектурным стандартам.
            Ответь на русском языке, будь конструктивным и объективным.
            """.formatted(solution, standardsContext);
    }

    /**
     * Форматирование стандартов для проверки
     */
    private String formatStandardsContext(List<Map<String, Object>> standards) {
        if (standards.isEmpty()) {
            return "*Нет доступных стандартов для проверки*";
        }

        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < Math.min(standards.size(), 5); i++) {
            Map<String, Object> standard = standards.get(i);
            String content = (String) standard.get("content");
            sb.append("### Стандарт ").append(i + 1).append("\n");
            sb.append(truncateContent(content, 1000)).append("\n\n");
        }
        return sb.toString();
    }

    /**
     * Вызов LLM через Ollama
     */
    private String callLLM(String prompt) {
        try {
            // Правильный способ вызова через ChatClient
            ChatClient chatClient = ChatClient.builder(chatModel).build();

            String response = chatClient.prompt()
                    .system("Ты — профессиональный ИТ-архитектор. Отвечай структурно и по делу. Используй Markdown для форматирования.")
                    .user(prompt)
                    .call()
                    .content();

            return response != null ? response : "Не удалось получить ответ от модели";

        } catch (Exception e) {
            System.err.println("Error calling LLM: " + e.getMessage());
            e.printStackTrace();
            return "Ошибка при вызове LLM: " + e.getMessage();
        }
    }

    /**
     * Сохранение решения в векторную БД для будущих референсов
     */
    private void saveSolutionToVectorStore(String solution, String task, UUID chatId) {
        try {
            float[] embedding = embeddingModel.embed(solution);
            String embeddingStr = arrayToPgVectorString(embedding);

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("type", "GENERATED_SOLUTION");
            metadata.put("chatId", chatId.toString());
            metadata.put("task", task);
            metadata.put("generatedAt", new Date().toString());
            metadata.put("model", chatModelName);

            String metadataJson = toJson(metadata);
            UUID id = UUID.randomUUID();

            String sql = """
                INSERT INTO vector_store (id, content, metadata, embedding)
                VALUES (?, ?, ?::jsonb, ?::vector)
                """;

            jdbcTemplate.update(sql, id, truncateContent(solution, 2000), metadataJson, embeddingStr);

        } catch (Exception e) {
            System.err.println("Error saving solution to vector store: " + e.getMessage());
        }
    }

    /**
     * Извлечение ключевых концепций из текста
     */
    private String extractKeyConcepts(String text) {
        // Упрощённая версия: берём первые 500 символов и ищем ключевые слова
        String shortText = text.length() > 500 ? text.substring(0, 500) : text;

        // Можно расширить для более умного извлечения
        return shortText;
    }

    /**
     * Обрезание контента до разумной длины
     */
    private String truncateContent(String content, int maxLength) {
        if (content == null) return "";
        if (content.length() <= maxLength) return content;
        return content.substring(0, maxLength) + "...";
    }

    /**
     * Конвертация float[] в строку для PostgreSQL vector
     */
    private String arrayToPgVectorString(float[] array) {
        if (array == null || array.length == 0) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < array.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(array[i]);
        }
        sb.append("]");
        return sb.toString();
    }

    /**
     * Конвертация Map в JSON строку
     */
    private String toJson(Map<String, Object> map) {
        StringBuilder sb = new StringBuilder("{");
        int count = 0;
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            if (count > 0) sb.append(",");
            sb.append("\"").append(entry.getKey()).append("\":");
            Object value = entry.getValue();
            if (value instanceof String) {
                sb.append("\"").append(value.toString().replace("\"", "\\\"")).append("\"");
            } else if (value instanceof Number) {
                sb.append(value);
            } else {
                sb.append("\"").append(value).append("\"");
            }
            count++;
        }
        sb.append("}");
        return sb.toString();
    }
}