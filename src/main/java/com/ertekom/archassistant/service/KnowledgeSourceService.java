package com.ertekom.archassistant.service;

import com.ertekom.archassistant.domain.entity.KnowledgeSource;
import com.ertekom.archassistant.repository.KnowledgeContentRepository;
import com.ertekom.archassistant.repository.KnowledgeFileRepository;
import com.ertekom.archassistant.repository.KnowledgeSourceRepository;
import com.ertekom.archassistant.repository.VectorStoreRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE,makeFinal = true)
public class KnowledgeSourceService {

    KnowledgeSourceRepository sourceRepository;
    KnowledgeFileRepository fileRepository;
    KnowledgeContentRepository contentRepository;
    VectorStoreRepository vectorStoreRepository;

    @Transactional
    public KnowledgeSource create(String repositoryUrl, String branch, String localPath) {
        KnowledgeSource source = new KnowledgeSource();
        source.setRepositoryUrl(repositoryUrl);
        source.setBranch(branch);
        source.setLocalPath(localPath);
        source.setCreatedAt(OffsetDateTime.now());
        return sourceRepository.save(source);
    }

    public List<KnowledgeSource> findAll() {
        return sourceRepository.findAll();
    }

    public KnowledgeSource findById(UUID id) {
        return sourceRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Источник знаний не найден: " + id));
    }

    @Transactional
    public void deleteById(UUID id) {
        vectorStoreRepository.deleteBySourceId(id);
        contentRepository.deleteByFile_Source_Id(id);
        fileRepository.deleteBySource_Id(id);
        sourceRepository.deleteById(id);
    }

    public KnowledgeSource createSource(String repositoryUrl, String branch, String localPath) {
        return create(repositoryUrl, branch, localPath);
    }

    public List<KnowledgeSource> getAllSources() {
        return findAll();
    }

    public KnowledgeSource getSourceById(UUID id) {
        return findById(id);
    }

    public void deleteSource(UUID id) {
        deleteById(id);
    }
}