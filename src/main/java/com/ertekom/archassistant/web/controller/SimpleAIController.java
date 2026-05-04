package com.ertekom.archassistant.web.controller;

import com.ertekom.archassistant.service.ai.SimpleAIService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class SimpleAIController {

    private final SimpleAIService simpleAIService;

    @GetMapping(value = "/stream", produces = "text/event-stream")
    public Flux<Map<String, String>> stream(@RequestParam String message,
                                            @RequestParam(required = false) UUID chatId) {
        return simpleAIService.askStream(message, chatId)
                .map(text -> Map.of("content", text));
    }

    @GetMapping(value = "/validate", produces = "text/event-stream")
    public Flux<Map<String, String>> validateSolution(@RequestParam String solution,
                                                      @RequestParam(required = false) UUID chatId) {
        return simpleAIService.validateStream(solution, chatId)
                .map(text -> Map.of("content", text));
    }

    @GetMapping(value = "/validate/document/{documentId}", produces = "text/event-stream")
    public Flux<Map<String, String>> validateDocument(
            @PathVariable UUID documentId,
            @RequestParam(required = false, defaultValue = "") String message,
            @RequestParam(required = false) UUID chatId) {
        return simpleAIService.validateDocumentStream(documentId, message, chatId)
                .map(text -> Map.of("content", text));
    }
}