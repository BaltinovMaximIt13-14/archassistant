package com.ertekom.archassistant.service.ai;

import com.ertekom.archassistant.service.learning.KnowledgeSearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.GetMapping;
import reactor.core.publisher.Flux;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SimpleAIService {

    private final OllamaChatModel chatModel;
    private final KnowledgeSearchService searchService;

    private static final int TOP_K = 5;

    public Flux<String> askStream(String question) {
        try {
            List<String> chunks = searchService.findRelevantChunks(question, TOP_K);

            String prompt;
            if (chunks.isEmpty()) {
                prompt = "Ответь на вопрос: " + question;
            } else {
                String context = String.join("\n\n---\n\n", chunks);
                prompt = """
                    Ты — ИТ-архитектор. Используй следующие знания для ответа.
                    Если знания не помогут, отвечай на основе своего опыта.

                    ЗНАНИЯ:
                    %s

                    ВОПРОС:
                    %s

                    ОТВЕТ:
                    """.formatted(context, question);
            }

            ChatClient client = ChatClient.builder(chatModel).build();

            return client.prompt()
                    .user(prompt)
                    .stream()
                    .content();
        } catch (Exception e) {
            log.error("AI ошибка: {}", e.getMessage(), e);
            return Flux.just("Ошибка: " + e.getMessage());
        }
    }


    public Flux<String> validateStream(String solution) {
        try {
            String prompt = """
            Ты — эксперт по ИТ-архитектуре. Проверь следующее решение на соответствие архитектурным стандартам и лучшим практикам из своей базы знаний(там есть файлы с стандартами, по которым ты должен проверять решение).
            Выдай отчёт по структуре: что соответствует, что нет, риски, твои рекомендации.
            Решение:
            %s
            """.formatted(solution);
            ChatClient client = ChatClient.builder(chatModel).build();
            return client.prompt().user(prompt).stream().content();
        } catch (Exception e) {
            return Flux.just("Ошибка проверки: " + e.getMessage());
        }
    }

}