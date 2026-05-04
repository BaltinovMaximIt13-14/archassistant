package com.ertekom.archassistant.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class OcrService {

  @Value("${ocr.tesseract.enabled:true}")
  private boolean enabled;

  @Value("${ocr.tesseract.executable:tesseract}")
  private String executable;

  @Value("${ocr.tesseract.language:rus+eng}")
  private String language;

  @Value("${ocr.tesseract.timeout-seconds:120}")
  private long timeoutSeconds;

  private Boolean available;

  public boolean isAvailable() {
    if (!enabled) return false;
    if (available != null) return available;

    try {
      Process process = new ProcessBuilder(executable, "--version").start();
      boolean completed = process.waitFor(10, TimeUnit.SECONDS);
      if (!completed) {
        process.destroyForcibly();
        available = false;
      } else {
        available = process.exitValue() == 0;
      }
    } catch (Exception e) {
      available = false;
      log.warn("Tesseract OCR is not available: {}", e.getMessage());
    }

    return available;
  }

  public String recognize(File imageFile) {
    if (!isAvailable()) return "";

    List<String> command = new ArrayList<>();
    command.add(executable);
    command.add(imageFile.getAbsolutePath());
    command.add("stdout");
    if (language != null && !language.isBlank()) {
      command.add("-l");
      command.add(language);
    }

    try {
      Process process = new ProcessBuilder(command).start();
      CompletableFuture<String> stdout = CompletableFuture.supplyAsync(() -> readStream(process.getInputStream()));
      CompletableFuture<String> stderr = CompletableFuture.supplyAsync(() -> readStream(process.getErrorStream()));

      boolean completed = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
      if (!completed) {
        process.destroyForcibly();
        log.warn("Tesseract OCR timed out for {}", imageFile.getName());
        return "";
      }

      String output = stdout.get(5, TimeUnit.SECONDS).trim();
      String error = stderr.get(5, TimeUnit.SECONDS).trim();

      if (process.exitValue() != 0) {
        log.warn("Tesseract OCR failed for {}: {}", imageFile.getName(), error);
        return "";
      }
      if (!error.isBlank()) {
        log.debug("Tesseract OCR output for {}: {}", imageFile.getName(), error);
      }
      return output;
    } catch (Exception e) {
      log.warn("Tesseract OCR failed for {}: {}", imageFile.getName(), e.getMessage());
      available = false;
      return "";
    }
  }

  public String recognize(BufferedImage image, String name) {
    if (!isAvailable()) return "";

    Path tempFile = null;
    try {
      tempFile = Files.createTempFile("ocr-" + sanitizeName(name) + "-", ".png");
      ImageIO.write(image, "png", tempFile.toFile());
      return recognize(tempFile.toFile());
    } catch (IOException e) {
      log.warn("Failed to prepare image for OCR {}: {}", name, e.getMessage());
      return "";
    } finally {
      if (tempFile != null) {
        try {
          Files.deleteIfExists(tempFile);
        } catch (IOException e) {
          log.debug("Failed to delete OCR temp file {}: {}", tempFile, e.getMessage());
        }
      }
    }
  }

  private String sanitizeName(String value) {
    if (value == null || value.isBlank()) return "image";
    return value.replaceAll("[^A-Za-z0-9._-]", "_");
  }

  private String readStream(InputStream inputStream) {
    try {
      return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
    } catch (IOException e) {
      return "";
    }
  }
}
