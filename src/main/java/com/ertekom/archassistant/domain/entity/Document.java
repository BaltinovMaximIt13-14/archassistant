package com.ertekom.archassistant.domain.entity;

import com.ertekom.archassistant.domain.entity.enums.DocumentType;
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
@Table(name = "documents")
@Getter
@Setter
@NoArgsConstructor
public class Document {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "documentId", nullable = false)
    private UUID id;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "file_path")
    private String filePath;

    @Column(name = "file_hash")
    private String fileHash;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "mime_type")
    private String mimeType;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_type")
    private DocumentType documentType;

    @Column(name = "extracted_text", columnDefinition = "TEXT")
    private String extractedText;

    @CreationTimestamp
    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @ManyToOne
    @JoinColumn(name = "chat_id")
    private Chat chat;

    @OneToMany(mappedBy = "document", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DocumentChunk> chunks = new ArrayList<>();
}