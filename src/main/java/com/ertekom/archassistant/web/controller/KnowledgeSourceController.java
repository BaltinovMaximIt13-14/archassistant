package com.ertekom.archassistant.web.controller;

import com.ertekom.archassistant.domain.entity.KnowledgeSource;
import com.ertekom.archassistant.service.KnowledgeSourceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/knowledge-sources")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class KnowledgeSourceController {

    private final KnowledgeSourceService knowledgeSourceService;

    @PostMapping
    public ResponseEntity<KnowledgeSource> create(@RequestBody Map<String, String> request) {
        String repositoryUrl = request.get("repositoryUrl");
        String branch = request.getOrDefault("branch", "main");
        String localPath = request.get("localPath");
        return ResponseEntity.ok(knowledgeSourceService.createSource(repositoryUrl, branch, localPath));
    }

    @GetMapping
    public ResponseEntity<List<KnowledgeSource>> getAll() {
        return ResponseEntity.ok(knowledgeSourceService.getAllSources());
    }

    @GetMapping("/{id}")
    public ResponseEntity<KnowledgeSource> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(knowledgeSourceService.getSourceById(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> delete(@PathVariable UUID id) {
        knowledgeSourceService.deleteSource(id);
        return ResponseEntity.ok(Map.of("message", "Knowledge source deleted successfully"));
    }
}