package com.ertekom.archassistant.service.ai;

import com.ertekom.archassistant.service.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AIService {

    private final OllamaService ollamaService;
    private final MessageService messageService;

    public Map<String, Object> generateSolution(String businessTask, UUID chatId) {
        String solution = ollamaService.generateSolution(businessTask, chatId);

        if (chatId != null) {
            messageService.createMessage(chatId, "user", businessTask);
            messageService.createMessage(chatId, "assistant", solution);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("solution", solution);
        response.put("solutionHtml", markdownToHtml(solution));
        return response;
    }

    public Map<String, String> validateSolution(String solution) {
        String report = ollamaService.validateSolution(solution);

        Map<String, String> response = new HashMap<>();
        response.put("report", report);
        response.put("reportHtml", markdownToHtml(report));
        return response;
    }

    public Map<String, Object> generateAndSaveToChat(UUID chatId, String businessTask) {
        messageService.createMessage(chatId, "user", businessTask);
        String solution = ollamaService.generateSolution(businessTask, chatId);
        messageService.createMessage(chatId, "assistant", solution);

        Map<String, Object> response = new HashMap<>();
        response.put("solution", solution);
        response.put("solutionHtml", markdownToHtml(solution));
        return response;
    }

    private String markdownToHtml(String markdown) {
        if (markdown == null) return "";
        return markdown
                .replaceAll("(?m)^### (.*)$", "<h3>$1</h3>")
                .replaceAll("(?m)^## (.*)$", "<h2>$1</h2>")
                .replaceAll("(?m)^# (.*)$", "<h1>$1</h1>")
                .replaceAll("\\*\\*(.*?)\\*\\*", "<strong>$1</strong>")
                .replaceAll("\\*(.*?)\\*", "<em>$1</em>")
                .replaceAll("\\n\\n", "<br/><br/>")
                .replaceAll("\\n", "<br/>");
    }
}