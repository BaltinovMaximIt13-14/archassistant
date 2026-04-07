package com.ertekom.archassistant.service.ai;

import com.ertekom.archassistant.service.learning.KnowledgeSearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SimpleAIService {

    private final OllamaChatModel chatModel;
    private final KnowledgeSearchService searchService;

    private static final int TOP_K = 5;

    public String ask(String question) {
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
            String response = client.prompt().user(prompt).call().content();
            return response != null ? response : "Нет ответа от модели";
        } catch (Exception e) {
            log.error("AI ошибка: {}", e.getMessage());
            return "Ошибка: " + e.getMessage();
        }
    }
}