package com.ertekom.archassistant.web.controller;

import com.ertekom.archassistant.service.ai.AIService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
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

    private Flux<Map<String, String>> toSse(Flux<String> stream) {
        return stream
                .concatWithValues(AIService.streamEndToken())
                .map(text -> Map.of("content", text));
    }

    @GetMapping(value = "/stream", produces = "text/event-stream")
    public Flux<Map<String, String>> stream(@RequestParam String message,
                                            @RequestParam(required = false) UUID chatId) {
        return toSse(AIService.askStream(message, chatId));
    }

    @GetMapping(value = "/validate", produces = "text/event-stream")
    public Flux<Map<String, String>> validateSolution(@RequestParam String solution,
                                                      @RequestParam(required = false) UUID chatId) {
        return toSse(AIService.validateStream(solution, chatId));
    }

    @GetMapping(value = "/validate/document/{documentId}", produces = "text/event-stream")
    public Flux<Map<String, String>> validateDocument(
            @PathVariable UUID documentId,
            @RequestParam(required = false, defaultValue = "") String message,
            @RequestParam(required = false) UUID chatId) {
        return toSse(AIService.validateDocumentStream(documentId, message, chatId));
    }

    @PostMapping("/validate/panel")
    public ResponseEntity<Map<String, Object>> generateValidationPanel(@RequestBody Map<String, String> request) {
        String report = request.getOrDefault("report", "");
        String sourceName = request.getOrDefault("sourceName", "");
        return ResponseEntity.ok(AIService.generateValidationPanel(report, sourceName));
    }

    @GetMapping(value = "/business", produces = "text/event-stream")
    public Flux<Map<String, String>> generateBusinessSolution(@RequestParam String input,
                                                              @RequestParam(required = false) UUID chatId) {
        return toSse(AIService.businessSolutionStream(input, chatId));
    }

    @GetMapping(value = "/business/document/{documentId}", produces = "text/event-stream")
    public Flux<Map<String, String>> generateBusinessSolutionFromDocument(
            @PathVariable UUID documentId,
            @RequestParam(required = false, defaultValue = "") String message,
            @RequestParam(required = false) UUID chatId) {
        return toSse(AIService.businessSolutionDocumentStream(documentId, message, chatId));
    }
}
