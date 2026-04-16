package com.ertekom.archassistant.domain.entity;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "knowledge_files")
@Getter
@Setter
@NoArgsConstructor
public class KnowledgeFile {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "fileId",nullable = false)
    private UUID id;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "file_path")
    private String filePath;

    @Column(name = "file_hash")
    private String fileHash;

    @Column(name = "version")
    private Integer version;

    @Column(name = "is_current")
    private Boolean isCurrent;

    @CreationTimestamp
    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @ManyToOne
    @JoinColumn(name = "source_id")
    @JsonBackReference
    private KnowledgeSource source;

    @OneToMany(mappedBy = "file", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<KnowledgeContent> contents = new ArrayList<>();

}