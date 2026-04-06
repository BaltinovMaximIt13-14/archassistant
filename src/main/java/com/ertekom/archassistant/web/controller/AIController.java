package com.ertekom.archassistant.web.controller;

import com.ertekom.archassistant.service.ai.AIService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
//@RequestMapping("/api/ai")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AIController {

    private final AIService aiService;

//    @PostMapping("/generate")
//    public ResponseEntity<Map<String, Object>> generateSolution(@RequestBody Map<String, String> request) {
//        String businessTask = request.get("task");
//        String chatIdStr = request.get("chatId");
//        UUID chatId = chatIdStr != null ? UUID.fromString(chatIdStr) : null;
//
//        Map<String, Object> response = aiService.generateSolution(businessTask, chatId);
//        return ResponseEntity.ok(response);
//    }
//
//    @PostMapping("/validate")
//    public ResponseEntity<Map<String, String>> validateSolution(@RequestBody Map<String, String> request) {
//        String solution = request.get("solution");
//        Map<String, String> response = aiService.validateSolution(solution);
//        return ResponseEntity.ok(response);
//    }
//
//    @PostMapping("/chat/{chatId}/generate")
//    public ResponseEntity<Map<String, Object>> generateWithChatContext(
//            @PathVariable UUID chatId,
//            @RequestBody Map<String, String> request) {
//        String businessTask = request.get("task");
//        Map<String, Object> response = aiService.generateAndSaveToChat(chatId, businessTask);
//        return ResponseEntity.ok(response);
//    }
}