package com.ertekom.archassistant.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
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
      log.warn("Функция распознавания текста Tesseract OCR недоступна: {}", e.getMessage());
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
        log.warn("В программе Tesseract OCR истекло время ожидания {}", imageFile.getName());
        return "";
      }

      String output = stdout.get(5, TimeUnit.SECONDS).trim();
      String error = stderr.get(5, TimeUnit.SECONDS).trim();

      if (process.exitValue() != 0) {
        log.warn("В программе Tesseract OCR истекло время ожидания {}: {}", imageFile.getName(), error);
        return "";
      }
      if (!error.isBlank()) {
        log.debug("Результат распознавания текста в Tesseract OCR {}: {}", imageFile.getName(), error);
      }
      return output;
    } catch (Exception e) {
      log.warn("Функция распознавания текста Tesseract OCR не удалась {}: {}", imageFile.getName(), e.getMessage());
      available = false;
      return "";
    }
  }

  private String readStream(InputStream inputStream) {
    try {
      return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
    } catch (IOException e) {
      return "";
    }
  }
}
