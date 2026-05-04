package com.ertekom.archassistant.service;

import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.tika.Tika;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

@Service
@RequiredArgsConstructor
public class TextExtractorService {

    private final Tika tika = new Tika();
    private final OcrService ocrService;

    public String extractText(MultipartFile file, String fileName) throws Exception {
        String lowerName = fileName != null ? fileName.toLowerCase() : "";

        if (lowerName.endsWith(".docx")) {
            return extractFromDocx(file);
        } else if (lowerName.endsWith(".pdf")) {
            return extractFromPdf(file);
        } else if (lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
            return extractFromText(file);
        } else if (isImageFile(lowerName)) {
            return extractFromImage(file, lowerName);
        } else if (lowerName.endsWith(".odt")) {
            return extractFromOdt(file);
        } else {
            return tika.parseToString(file.getInputStream());
        }
    }

    public String extractText(File file) throws Exception {
        String lowerName = file.getName().toLowerCase();

        if (lowerName.endsWith(".docx")) {
            return extractFromDocx(file);
        } else if (lowerName.endsWith(".pdf")) {
            return extractFromPdf(file);
        } else if (lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
            return Files.readString(file.toPath(), StandardCharsets.UTF_8);
        } else if (isImageFile(lowerName)) {
            return ocrService.recognize(file);
        } else if (lowerName.endsWith(".odt")) {
            return tika.parseToString(file);
        } else {
            return tika.parseToString(file);
        }
    }

    private String extractFromDocx(MultipartFile file) throws Exception {
        try (InputStream is = file.getInputStream()) {
            return extractFromDocx(is);
        }
    }

    private String extractFromDocx(File file) throws Exception {
        try (InputStream is = Files.newInputStream(file.toPath())) {
            return extractFromDocx(is);
        }
    }

    private String extractFromDocx(InputStream is) throws Exception {
        StringBuilder text = new StringBuilder();
        try (XWPFDocument doc = new XWPFDocument(is)) {

            for (XWPFParagraph paragraph : doc.getParagraphs()) {
                String paraText = paragraph.getText();
                if (paraText != null && !paraText.isEmpty()) {
                    text.append(paraText).append("\n");
                }
            }
        }
        return text.toString();
    }

    private String extractFromPdf(MultipartFile file) throws Exception {
        try (InputStream is = file.getInputStream()) {
            return extractFromPdf(is);
        }
    }

    private String extractFromPdf(File file) throws Exception {
        try (InputStream is = Files.newInputStream(file.toPath())) {
            return extractFromPdf(is);
        }
    }

    private String extractFromPdf(InputStream is) throws Exception {
        StringBuilder text = new StringBuilder();
        try (PDDocument document = Loader.loadPDF(is.readAllBytes())) {
            for (int page = 1; page <= document.getNumberOfPages(); page++) {
                PDFTextStripper stripper = new PDFTextStripper();
                stripper.setStartPage(page);
                stripper.setEndPage(page);
                stripper.setSortByPosition(true);

                String pageText = normalizeText(stripper.getText(document));
                text.append(pageText);

                if (page < document.getNumberOfPages()) {
                    text.append("\n\n");
                }
            }
        }
        return text.toString();
    }

    private String extractFromText(MultipartFile file) throws Exception {
        return new String(file.getBytes(), StandardCharsets.UTF_8);
    }

    private String extractFromImage(MultipartFile file, String fileName) throws Exception {
        Path tempFile = Files.createTempFile("upload-image-", getImageSuffix(fileName));
        try {
            Files.write(tempFile, file.getBytes());
            return ocrService.recognize(tempFile.toFile());
        } finally {
            Files.deleteIfExists(tempFile);
        }
    }

    private String extractFromOdt(MultipartFile file) throws Exception {
        return tika.parseToString(file.getInputStream());
    }

    private boolean isImageFile(String lowerName) {
        return lowerName.endsWith(".png") ||
                lowerName.endsWith(".jpg") ||
                lowerName.endsWith(".jpeg") ||
                lowerName.endsWith(".tif") ||
                lowerName.endsWith(".tiff") ||
                lowerName.endsWith(".bmp");
    }

    private String normalizeText(String text) {
        if (text == null) return "";
        return text
                .replace("\r\n", "\n")
                .replace('\r', '\n')
                .trim();
    }

    private String getImageSuffix(String fileName) {
        int dotIndex = fileName == null ? -1 : fileName.lastIndexOf('.');
        if (dotIndex >= 0 && dotIndex < fileName.length() - 1) {
            return fileName.substring(dotIndex);
        }
        return ".png";
    }
}
