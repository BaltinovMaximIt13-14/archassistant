package com.ertekom.archassistant.web.controller;

import com.ertekom.archassistant.service.ai.AIService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@FieldDefaults(level = AccessLevel.PRIVATE,makeFinal = true)
public class AIController {

    AIService AIService;

    @GetMapping(value = "/stream", produces = "text/event-stream")
    public Flux<Map<String, String>> stream(@RequestParam String message,
                                            @RequestParam(required = false) UUID chatId) {
        return AIService.askStream(message, chatId)
                .map(text -> Map.of("content", text));
    }

    @GetMapping(value = "/validate", produces = "text/event-stream")
    public Flux<Map<String, String>> validateSolution(@RequestParam String solution,
                                                      @RequestParam(required = false) UUID chatId) {
        return AIService.validateStream(solution, chatId)
                .map(text -> Map.of("content", text));
    }

    @GetMapping(value = "/validate/document/{documentId}", produces = "text/event-stream")
    public Flux<Map<String, String>> validateDocument(
            @PathVariable UUID documentId,
            @RequestParam(required = false, defaultValue = "") String message,
            @RequestParam(required = false) UUID chatId) {
        return AIService.validateDocumentStream(documentId, message, chatId)
                .map(text -> Map.of("content", text));
    }
}