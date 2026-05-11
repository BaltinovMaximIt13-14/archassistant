package com.ertekom.archassistant.service.learning;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE,makeFinal = true)
public class KnowledgeSearchService {

    VectorStore vectorStore;

    public List<String> findRelevantChunks(String query, int topK) {
        try {
            var request = SearchRequest.builder()
                    .query(query)
                    .topK(topK)
                    .similarityThreshold(0.6)
                    .build();
            var results = vectorStore.similaritySearch(request);
            return results.stream()
                    .map(doc -> doc.getText())
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Ошибка поиска: {}", e.getMessage());
            return List.of();
        }
    }
}