package com.ertekom.archassistant.config;

import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.OllamaEmbeddingModel;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.ai.ollama.api.OllamaOptions;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OllamaConfig {

    @Value("${spring.ai.ollama.base-url:http://localhost:11434}")
    private String baseUrl;

    @Value("${spring.ai.ollama.chat.model:llama3.2}")
    private String chatModelName;

    @Value("${spring.ai.ollama.embedding.model:nomic-embed-text}")
    private String embeddingModelName;

    @Bean
    public OllamaApi ollamaApi() {
        return new OllamaApi(baseUrl);
    }

    @Bean
    public OllamaChatModel ollamaChatModel(OllamaApi ollamaApi) {
        return OllamaChatModel.builder()
                .ollamaApi(ollamaApi)
                .defaultOptions(OllamaOptions.builder()
                        .model(chatModelName)
                        .temperature(0.3)
                        .topK(50)
                        .topP(0.9)
                        .build())
                .build();
    }

    @Bean
    public EmbeddingModel embeddingModel(OllamaApi ollamaApi) {
        return OllamaEmbeddingModel.builder()
                .ollamaApi(ollamaApi)
                .defaultOptions(OllamaOptions.builder()
                        .model(embeddingModelName)
                        .build())
                .build();
    }
}