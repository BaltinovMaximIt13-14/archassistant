package com.ertekom.archassistant.domain.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "document_chunks")
@Getter
@Setter
@NoArgsConstructor
public class DocumentChunk {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "chunkId", nullable = false)
    private UUID id;

    @Column(name = "chunk_index", nullable = false)
    private Integer chunkIndex;

    @Column(name = "chunk_content", columnDefinition = "TEXT", nullable = false)
    private String chunkContent;

    @CreationTimestamp
    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @ManyToOne
    @JoinColumn(name = "document_id")
    private Document document;

    @ManyToOne
    @JoinColumn(name = "chat_id")
    private Chat chat;
}