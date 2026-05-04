package com.ertekom.archassistant.domain.entity;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "knowledge_contents")
@Getter
@Setter
@NoArgsConstructor
public class KnowledgeContent {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "contentId",nullable = false)
    private UUID id;

    @Column(name = "chunk_index", nullable = false)
    private Integer chunkIndex;

    @Column(name = "chunk_content", columnDefinition = "TEXT")
    private String chunkContent;

    @CreationTimestamp
    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @ManyToOne
    @JoinColumn(name = "file_id")
    @JsonBackReference
    private KnowledgeFile file;
}