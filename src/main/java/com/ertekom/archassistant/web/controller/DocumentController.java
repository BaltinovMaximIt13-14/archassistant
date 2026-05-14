package com.ertekom.archassistant.web.controller;

import com.ertekom.archassistant.domain.entity.Document;
import com.ertekom.archassistant.domain.entity.DocumentChunk;
import com.ertekom.archassistant.service.DocumentService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@FieldDefaults(level = AccessLevel.PRIVATE,makeFinal = true)
public class DocumentController {

    DocumentService documentService;

    @PostMapping("/upload/{chatId}")
    public ResponseEntity<Map<String, Object>> uploadDocument(
            @PathVariable UUID chatId,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(documentService.uploadDocument(chatId, file));
    }

    @GetMapping("/chat/{chatId}")
    public ResponseEntity<List<Document>> getDocumentsByChat(@PathVariable UUID chatId) {
        return ResponseEntity.ok(documentService.getDocumentsByChat(chatId));
    }

    @DeleteMapping("/{documentId}")
    public ResponseEntity<Map<String, String>> deleteDocument(@PathVariable UUID documentId) {
        documentService.deleteDocument(documentId);
        return ResponseEntity.ok(Map.of("message", "Document deleted successfully"));
    }

    @GetMapping("/{documentId}/chunks")
    public ResponseEntity<List<DocumentChunk>> getDocumentChunks(@PathVariable UUID documentId) {
        return ResponseEntity.ok(documentService.getDocumentChunks(documentId));
    }
}