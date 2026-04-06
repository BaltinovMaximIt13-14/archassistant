package com.ertekom.archassistant.domain.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "knowledge_sources")
@Getter
@Setter
@NoArgsConstructor
public class KnowledgeSource {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "sourceId",nullable = false)
    private UUID id;

    @Column(name = "repository_url", nullable = false)
    private String repositoryUrl;

    @Column(name = "branch", length = 100)
    private String branch;

    @Column(name = "local_path")
    private String localPath;

    @CreationTimestamp
    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "last_sync")
    private OffsetDateTime lastSync;

    @OneToMany(mappedBy = "source", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<KnowledgeFile> files = new ArrayList<>();

}