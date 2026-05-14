package com.ertekom.archassistant.web.controller;

import com.ertekom.archassistant.domain.entity.Chat;
import com.ertekom.archassistant.domain.entity.Message;
import com.ertekom.archassistant.service.ChatService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/chats")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@FieldDefaults(level = AccessLevel.PRIVATE,makeFinal = true)
public class ChatController {

    ChatService chatService;

    @PostMapping
    public ResponseEntity<Chat> createChat(@RequestBody(required = false) Map<String, String> request) {
        String title = request != null ? request.get("title") : null;
        return ResponseEntity.ok(chatService.createChat(title));
    }

    @GetMapping
    public ResponseEntity<List<Chat>> getAllChats() {
        return ResponseEntity.ok(chatService.getAllChats());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Chat> getChat(@PathVariable UUID id) {
        return ResponseEntity.ok(chatService.getChatById(id));
    }

    @GetMapping("/{id}/messages")
    public ResponseEntity<List<Message>> getMessages(@PathVariable UUID id) {
        return ResponseEntity.ok(chatService.getChatMessages(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Chat> updateChatTitle(@PathVariable UUID id, @RequestBody Map<String, String> request) {
        String title = request.get("title");
        return ResponseEntity.ok(chatService.updateChatTitle(id, title));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteChat(@PathVariable UUID id) {
        chatService.deleteChat(id);
        return ResponseEntity.ok(Map.of("message", "Chat deleted successfully"));
    }

    @PutMapping("/{id}/pin")
    public ResponseEntity<Map<String, Object>> togglePin(@PathVariable UUID id) {
        Chat chat = chatService.togglePin(id);
        return ResponseEntity.ok(Map.of(
                "id", chat.getId(),
                "pinned", chat.isPinned()
        ));
    }
}