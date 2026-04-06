package com.ertekom.archassistant.web.controller;

import com.ertekom.archassistant.service.ai.SimpleAIService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class SimpleAIController {

    private final SimpleAIService simpleAIService;

    @PostMapping("/generate")
    public ResponseEntity<Map<String, String>> generate(@RequestBody Map<String, String> request) {
        String message = request.get("message");
        String responseText = simpleAIService.ask(message);

        Map<String, String> response = new HashMap<>();
        response.put("response", responseText == null ? "Нет ответа" : responseText);

        // Убеждаемся, что JSON валидный – просто возвращаем Map
        return ResponseEntity.ok(response);
    }
}