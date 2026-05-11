package com.ertekom.archassistant.service;

import com.ertekom.archassistant.domain.entity.Chat;
import com.ertekom.archassistant.domain.entity.Document;
import com.ertekom.archassistant.domain.entity.DocumentChunk;
import com.ertekom.archassistant.domain.entity.enums.DocumentType;
import com.ertekom.archassistant.repository.DocumentChunkRepository;
import com.ertekom.archassistant.repository.DocumentRepository;
import com.ertekom.archassistant.repository.VectorStoreRepository;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.apache.tika.Tika;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE,makeFinal = true)
public class DocumentService {

    DocumentRepository documentRepository;
    DocumentChunkRepository documentChunkRepository;
    VectorStoreRepository vectorStoreRepository;
    ChatService chatService;
    TextExtractorService textExtractorService;
    Tika tika = new Tika();

    @Transactional
    public Document createDocument(UUID chatId, String fileName, String fileHash,
                                   Long fileSize, String mimeType, DocumentType documentType, String extractedText) {
        Chat chat = chatService.findById(chatId);

        Document document = new Document();
        document.setChat(chat);
        document.setFileName(fileName);
        document.setFileHash(fileHash);
        document.setFileSize(fileSize);
        document.setMimeType(mimeType);
        document.setDocumentType(documentType);
        document.setExtractedText(extractedText);
        document.setCreatedAt(OffsetDateTime.now());

        return documentRepository.save(document);
    }

    public List<Document> findByChatId(UUID chatId) {
        return documentRepository.findByChat_IdOrderByCreatedAtDesc(chatId);
    }

    @Transactional
    public void deleteById(UUID id) {
        vectorStoreRepository.deleteByDocumentId(id);
        documentChunkRepository.deleteByDocument_Id(id);
        documentRepository.deleteById(id);
    }

    public Map<String, Object> uploadDocument(UUID chatId, MultipartFile file) {
        Map<String, Object> response = new HashMap<>();

        try {
            String originalFileName = file.getOriginalFilename();
            byte[] fileBytes = file.getBytes();
            String mimeType = tika.detect(fileBytes);
            DocumentType documentType = detectDocumentTypeByExtension(originalFileName);
            String extractedText = textExtractorService.extractText(file, originalFileName);
            String fileHash = calculateHash(fileBytes);

            Document document = createDocument(
                    chatId,
                    originalFileName != null ? originalFileName : "unknown",
                    fileHash,
                    file.getSize(),
                    mimeType,
                    documentType,
                    extractedText
            );

            List<String> chunks = splitIntoChunks(extractedText, 1000);
            for (int i = 0; i < chunks.size(); i++) {
                saveChunk(document.getId(), chatId, i, chunks.get(i));
            }

            response.put("success", true);
            response.put("documentId", document.getId().toString());
            response.put("fileName", document.getFileName());
            response.put("documentType", documentType.name());
            response.put("chunksCount", chunks.size());
            response.put("extractedTextLength", extractedText.length());
            response.put("preview", extractedText.substring(0, Math.min(500, extractedText.length())));
            response.put("message", "Документ успешно загружен");

        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Ошибка: " + e.getMessage());
        }

        return response;
    }

    private void saveChunk(UUID documentId, UUID chatId, Integer chunkIndex, String chunkContent) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new RuntimeException("Документ не найден: " + documentId));
        Chat chat = chatService.findById(chatId);

        DocumentChunk chunk = new DocumentChunk();
        chunk.setDocument(document);
        chunk.setChat(chat);
        chunk.setChunkIndex(chunkIndex);
        chunk.setChunkContent(chunkContent);
        chunk.setCreatedAt(OffsetDateTime.now());

        documentChunkRepository.save(chunk);
    }

    public List<Document> getDocumentsByChat(UUID chatId) {
        return findByChatId(chatId);
    }

    public void deleteDocument(UUID documentId) {
        deleteById(documentId);
    }

    public List<DocumentChunk> getDocumentChunks(UUID documentId) {
        return documentChunkRepository.findByDocument_Id(documentId);
    }

    private DocumentType detectDocumentTypeByExtension(String fileName) {
        if (fileName == null) return DocumentType.UNKNOWN;
        String lowerName = fileName.toLowerCase();

        if (lowerName.endsWith(".pdf")) return DocumentType.PDF;
        if (lowerName.endsWith(".docx") || lowerName.endsWith(".doc")) return DocumentType.DOCX;
        if (lowerName.endsWith(".odt")) return DocumentType.ODT;
        if (lowerName.endsWith(".txt")) return DocumentType.TXT;
        if (lowerName.endsWith(".md")) return DocumentType.MARKDOWN;
        if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) return DocumentType.HTML;
        return DocumentType.UNKNOWN;
    }

    private List<String> splitIntoChunks(String text, int chunkSize) {
        List<String> chunks = new ArrayList<>();
        if (text == null || text.isEmpty()) {
            chunks.add("Пустой документ");
            return chunks;
        }
        for (int i = 0; i < text.length(); i += chunkSize) {
            int end = Math.min(text.length(), i + chunkSize);
            chunks.add(text.substring(i, end));
        }
        return chunks;
    }

    private String calculateHash(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(bytes);
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            return UUID.randomUUID().toString();
        }
    }
}