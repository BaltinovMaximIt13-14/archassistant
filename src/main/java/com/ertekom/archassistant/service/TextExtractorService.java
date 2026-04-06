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

import java.io.InputStream;

@Service
@RequiredArgsConstructor
public class TextExtractorService {

    private final Tika tika = new Tika();

    public String extractText(MultipartFile file, String fileName) throws Exception {
        String lowerName = fileName.toLowerCase();

        if (lowerName.endsWith(".docx")) {
            return extractFromDocx(file);
        } else if (lowerName.endsWith(".pdf")) {
            return extractFromPdf(file);
        } else if (lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
            return extractFromText(file);
        } else if (lowerName.endsWith(".odt")) {
            return extractFromOdt(file);
        } else {
            return tika.parseToString(file.getInputStream());
        }
    }

    private String extractFromDocx(MultipartFile file) throws Exception {
        StringBuilder text = new StringBuilder();
        try (InputStream is = file.getInputStream();
             XWPFDocument doc = new XWPFDocument(is)) {

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
        StringBuilder text = new StringBuilder();
        try (InputStream is = file.getInputStream();
             PDDocument document = Loader.loadPDF(is.readAllBytes())) {

            PDFTextStripper stripper = new PDFTextStripper();
            String pdfText = stripper.getText(document);
            text.append(pdfText);
        }
        return text.toString();
    }

    private String extractFromText(MultipartFile file) throws Exception {
        return new String(file.getBytes(), "UTF-8");
    }

    private String extractFromOdt(MultipartFile file) throws Exception {
        return tika.parseToString(file.getInputStream());
    }
}