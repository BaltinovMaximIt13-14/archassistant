package com.ertekom.archassistant.service.learning;

import com.ertekom.archassistant.domain.entity.KnowledgeContent;
import com.ertekom.archassistant.domain.entity.KnowledgeFile;
import com.ertekom.archassistant.domain.entity.KnowledgeSource;
import com.ertekom.archassistant.repository.KnowledgeContentRepository;
import com.ertekom.archassistant.repository.KnowledgeFileRepository;
import com.ertekom.archassistant.repository.KnowledgeSourceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.FileUtils;
import org.apache.tika.Tika;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class GitLabSyncService {

    private final KnowledgeSourceRepository sourceRepository;
    private final KnowledgeFileRepository fileRepository;
    private final KnowledgeContentRepository contentRepository;
    private final Tika tika = new Tika();

    // Временная директория для клонирования репозиториев
    private static final String TEMP_DIR_PREFIX = "gitlab-sync-";
}