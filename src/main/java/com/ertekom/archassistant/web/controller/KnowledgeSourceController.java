package com.ertekom.archassistant.web.controller;

import com.ertekom.archassistant.domain.entity.KnowledgeContent;
import com.ertekom.archassistant.domain.entity.KnowledgeFile;
import com.ertekom.archassistant.domain.entity.KnowledgeSource;
import com.ertekom.archassistant.repository.KnowledgeContentRepository;
import com.ertekom.archassistant.repository.KnowledgeFileRepository;
import com.ertekom.archassistant.service.KnowledgeSourceService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.DeleteMapping;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/knowledge-sources")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@FieldDefaults(level = AccessLevel.PRIVATE,makeFinal = true)
public class KnowledgeSourceController {

    KnowledgeSourceService knowledgeSourceService;
    KnowledgeFileRepository knowledgeFileRepository;
    KnowledgeContentRepository knowledgeContentRepository;

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

    @GetMapping("/{sourceId}/files")
    public ResponseEntity<List<KnowledgeFile>> getSourceFiles(@PathVariable UUID sourceId) {
        List<KnowledgeFile> files = knowledgeFileRepository.findBySource_Id(sourceId);
        return ResponseEntity.ok(files);
    }

    @GetMapping("/files/{fileId}/contents")
    public ResponseEntity<List<KnowledgeContent>> getFileContents(@PathVariable UUID fileId) {
        List<KnowledgeContent> contents = knowledgeContentRepository.findByFile_Id(fileId);
        return ResponseEntity.ok(contents);
    }
}