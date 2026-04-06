package com.ertekom.archassistant.web.dto.request;

import lombok.Data;
import lombok.Getter;

@Data
public class ChatRequest {
    private String message;
    private String chatId;
}
