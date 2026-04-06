package com.ertekom.archassistant.service.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class SimpleAIService {

    private final OllamaChatModel chatModel;

    /**
     * Простой запрос к ИИ без истории, без промптов
     */
    public String ask(String question) {
        try {
            ChatClient chatClient = ChatClient.builder(chatModel).build();

            String response = chatClient.prompt()
                    .user(question)
                    .call()
                    .content();

            return response != null ? response : "Нет ответа от модели";

        } catch (Exception e) {
            log.error("Ошибка при вызове AI: {}", e.getMessage());
            return "Ошибка: " + e.getMessage();
        }
    }
}