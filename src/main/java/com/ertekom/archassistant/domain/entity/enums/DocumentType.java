package com.ertekom.archassistant.domain.entity.enums;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.experimental.FieldDefaults;

@FieldDefaults(level = AccessLevel.PRIVATE,makeFinal = true)
@AllArgsConstructor
@Getter
public enum DocumentType {
    PDF("PDF документ"),
    DOCX("Microsoft Word документ"),
    ODT("OpenDocument текст"),
    TXT("Текстовый файл"),
    MARKDOWN("Markdown документ"),
    HTML("HTML страница"),
    UNKNOWN("Неизвестный формат");

    String description;
}