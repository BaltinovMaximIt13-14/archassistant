package com.ertekom.archassistant.web.controller;

import com.ertekom.archassistant.service.ai.SimpleAIService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.Map;


@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class SimpleAIController {

    private final SimpleAIService simpleAIService;

    @GetMapping(value = "/stream", produces = "text/event-stream")
    public Flux<Map<String, String>> stream(@RequestParam String message) {
        return simpleAIService.askStream(message)
                .map(text -> Map.of("content", text));
    }

    @GetMapping("/validate")
    public Flux<String> validateSolution(@RequestParam String solution) {
        return simpleAIService.validateStream(solution);
    }
}