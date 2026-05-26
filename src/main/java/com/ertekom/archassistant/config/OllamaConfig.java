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

  @Value("${spring.ai.ollama.chat.options.temperature:0.0}")
  private Double temperature;

  @Value("${spring.ai.ollama.chat.options.top_k:10}")
  private Integer topK;

  @Value("${spring.ai.ollama.chat.options.top_p:0.1}")
  private Double topP;

  @Value("${spring.ai.ollama.chat.options.num_ctx:4096}")
  private Integer numCtx;

  @Value("${spring.ai.ollama.chat.options.num_predict:1536}")
  private Integer numPredict;

  @Value("${spring.ai.ollama.chat.options.num_thread:8}")
  private Integer numThread;

  @Value("${spring.ai.ollama.chat.options.seed:42}")
  private Integer seed;

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
            .temperature(temperature)
            .topK(topK)
            .topP(topP)
            .numCtx(numCtx)
            .numPredict(numPredict)
            .numThread(numThread)
            .seed(seed)
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
