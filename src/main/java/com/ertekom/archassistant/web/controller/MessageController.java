package com.ertekom.archassistant.web.controller;

import com.ertekom.archassistant.domain.entity.Message;
import com.ertekom.archassistant.service.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class MessageController {

    private final MessageService messageService;

    @PostMapping
    public ResponseEntity<Message> createMessage(@RequestBody Map<String, String> request) {
        UUID chatId = UUID.fromString(request.get("chatId"));
        String role = request.get("role");
        String content = request.get("content");
        return ResponseEntity.ok(messageService.createMessage(chatId, role, content));
    }

    @GetMapping("/chat/{chatId}")
    public ResponseEntity<List<Message>> getMessagesByChat(@PathVariable UUID chatId) {
        return ResponseEntity.ok(messageService.getMessagesByChat(chatId));
    }
}