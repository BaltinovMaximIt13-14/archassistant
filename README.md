# ER-Assistant | ArchAssistant

Помощит ИТ-архитектора на основе AI (Ollama) с RAG (Retrieval-Augmented Generation). Приложение позволяет анализировать архитектурные решения, проверять соответствие стандартам, генерировать бизнес-решения и вести диалог с AI.

## 🚀 Возможности

- **Чат с AI** - общение с ИТ-архитектором на русском языке
- **Проверка решений** - анализ архитектурных решений на соответствие стандартам
- **Генерация бизнес-решений** - создание комплексных бизнес-решений по шаблону
- **RAG с GitLab** - загрузка и синхронизация баз знаний из GitLab репозиториев
- **Управление чатами** - создание, переименование, удаление, закрепление чатов
- **Редактирование сообщений** - возможность редактировать отправленные сообщения
- **Тёмная/светлая тема** - поддержка двух тем интерфейса
- **Мультиязычность** - русский и английский язык интерфейса
- **Настройки модели** - прямо из веб-интерфейса можно настроить ИИ-модель

## 🛠 Технологический стек

### Backend
- Java 21
- Spring Boot 3.5.7
- Spring Data JPA
- PostgreSQL (с pgvector для векторного поиска)
- Ollama (локальный AI)
- JGit (работа с GitLab)
- Apache Tika (извлечение текста из файлов)
- Liquibase (миграции БД)

### Frontend
- HTML5/CSS3
- TailwindCSS
- JavaScript (Vanilla)
- Marked.js (Markdown рендеринг)

## 📋 Требования

- Java 21+
- Docker / Docker Compose
- PostgreSQL 15+ с pgvector
- Ollama (локально или в Docker)

## 🚀 Быстрый старт

### 1. Клонирование репозитория

```bash
git clone https://gitlab.com/your-repo/archassistant.git
cd archassistant
```

### 2. Запуск через Docker Compose (рекомендуемый способ)

#### 2.1. Убедитесь, что Docker и Docker Compose установлены:

```bash
docker --version
docker-compose --version
```

#### 2.2. Запустите все сервисы одной командой:

```bash
docker-compose up -d
```

Эта команда автоматически поднимет:
- PostgreSQL с pgvector (доступен только внутри Docker-сети)
- Ollama с моделями qwen3:1.7b и nomic-embed-text (доступен только внутри Docker-сети)
- Spring Boot приложение (доступно на порту 8080)

#### 2.3. Проверьте статус контейнеров:

```bash
docker-compose ps
```

Все контейнеры должны быть в статусе `Up` или `Running`.

#### 2.4. Просмотр логов:

```bash
# Логи всех сервисов
docker-compose logs -f

# Только логи приложения
docker-compose logs -f app

# Только логи базы данных
docker-compose logs -f postgres

# Только логи Ollama
docker-compose logs -f ollama
```

#### 2.5. Проверка работоспособности:

```bash
# Проверка, что приложение отвечает
curl http://localhost:8080/api/chats

# Проверка логов приложения
docker-compose logs app | tail -20
```

> **Примечание:** PostgreSQL и Ollama теперь доступны **только внутри Docker-сети** и не имеют внешних портов. Это сделано для безопасности. Приложение подключается к ним по именам сервисов (`postgres:5432`, `ollama:11434`).

#### 2.6. Доступ к приложению:

Откройте в браузере: http://localhost:8080

#### 2.7. Остановка всех сервисов:

```bash
# Остановка контейнеров
docker-compose down

# Остановка с удалением всех данных (очистка БД и моделей)
docker-compose down -v
```

### 3. Ручной запуск (для разработки)

#### 3.1. Настройка PostgreSQL

```bash
# Запуск PostgreSQL с pgvector (с внешним портом для разработки)
docker run -d \
  --name postgres-pgvector \
  -e POSTGRES_DB=archassistant \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

#### 3.2. Настройка Ollama

```bash
# Запуск Ollama (с внешним портом для разработки)
docker run -d \
  --name ollama \
  -v ollama_data:/root/.ollama \
  -p 11434:11434 \
  ollama/ollama

# Установка модели для чата
docker exec ollama ollama pull qwen3:1.7b

# Установка модели для эмбеддингов
docker exec ollama ollama pull nomic-embed-text
```

#### 3.3. Настройка приложения

Создайте файл `application-local.properties`:

```properties
# PostgreSQL
spring.datasource.url=jdbc:postgresql://localhost:5432/archassistant
spring.datasource.username=postgres
spring.datasource.password=postgres

# Ollama
spring.ai.ollama.base-url=http://localhost:11434
spring.ai.ollama.chat.options.model=qwen3:1.7b
spring.ai.ollama.chat.options.temperature=0.3
spring.ai.ollama.chat.options.num-predict=500
spring.ai.ollama.embedding.model=nomic-embed-text

# Логирование
logging.level.com.ertekom.archassistant=DEBUG
```

#### 3.4. Сборка приложения

```bash
# Linux/Mac
./gradlew clean build

# Windows
gradlew.bat clean build
```

#### 3.5. Запуск приложения

```bash
# Linux/Mac
./gradlew bootRun

# Windows
gradlew.bat bootRun

# Или через jar
java -jar build/libs/*.jar
```

### 4. Настройка моделей Ollama

#### 4.1. Список доступных моделей:

```bash
# Показать установленные модели
docker exec archassistant-ollama ollama list
```

#### 4.2. Установка других моделей:

```bash
# Для чата (лёгкие модели)
docker exec archassistant-ollama ollama pull llama3.2:1b
docker exec archassistant-ollama ollama pull mistral:7b
docker exec archassistant-ollama ollama pull gemma2:2b

# Для эмбеддингов (альтернативы)
docker exec archassistant-ollama ollama pull nomic-embed-text
docker exec archassistant-ollama ollama pull all-minilm
```

#### 4.3. Удаление модели:

```bash
docker exec archassistant-ollama ollama rm qwen3:1.7b
```

### 5. Конфигурация приложения

#### 5.1. Основные настройки в `application.properties`:

```properties
# Сервер
server.port=8080

# База данных
spring.datasource.url=jdbc:postgresql://localhost:5432/archassistant
spring.datasource.username=postgres
spring.datasource.password=postgres

# JPA
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true

# Ollama
spring.ai.ollama.base-url=http://localhost:11434
spring.ai.ollama.chat.options.model=qwen3:1.7b
spring.ai.ollama.chat.options.temperature=0.3
spring.ai.ollama.chat.options.num-predict=500
spring.ai.ollama.embedding.model=nomic-embed-text

# Векторное хранилище
spring.ai.vectorstore.pgvector.index-type=HNSW
spring.ai.vectorstore.pgvector.distance-type=COSINE_DISTANCE
spring.ai.vectorstore.pgvector.dimensions=768

# GitLab синхронизация
gitlab.sync.batch-size=100
gitlab.sync.max-file-size=10MB
```

#### 5.2. Настройки через переменные окружения:

```bash
export DB_URL=jdbc:postgresql://localhost:5432/archassistant
export DB_USERNAME=postgres
export DB_PASSWORD=postgres
export OLLAMA_URL=http://localhost:11434
export OLLAMA_MODEL=qwen3:1.7b
export OLLAMA_TEMPERATURE=0.3
export OLLAMA_NUM_PREDICT=500
```

## 📁 Структура проекта

```
archassistant/
├── src/main/java/com/ertekom/archassistant/
│   ├── config/              # Конфигурации (CORS, Ollama)
│   ├── domain/entity/       # JPA сущности
│   ├── repository/          # Spring Data репозитории
│   ├── service/             # Бизнес-логика
│   │   ├── ai/             # AI сервисы
│   │   ├── gitlab/         # Интеграция с GitLab
│   │   └── learning/       # RAG и поиск
│   └── web/controller/      # REST контроллеры
├── src/main/resources/
│   ├── static/              # HTML, CSS, JS
│   ├── db/changelog/        # Liquibase миграции
│   └── application.properties
├── docker-compose.yml
├── Dockerfile
└── build.gradle
```

## 📖 API Эндпоинты

### Чаты
| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/chats` | Получить все чаты |
| POST | `/api/chats` | Создать новый чат |
| PUT | `/api/chats/{id}` | Обновить название чата |
| PUT | `/api/chats/{id}/pin` | Закрепить/открепить чат |
| DELETE | `/api/chats/{id}` | Удалить чат |

### Сообщения
| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/messages/chat/{chatId}` | Получить сообщения чата |
| POST | `/api/messages` | Создать сообщение |
| PUT | `/api/messages/{id}` | Обновить сообщение |
| DELETE | `/api/messages/{id}` | Удалить сообщение |

### AI
| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/ai/stream` | Обычный чат (SSE) |
| GET | `/api/ai/validate` | Проверка решения (SSE) |
| GET | `/api/ai/business` | Генерация бизнес-решения (SSE) |

### Источники знаний (GitLab)
| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/knowledge-sources` | Список источников |
| POST | `/api/knowledge-sources` | Добавить источник |
| POST | `/api/knowledge/sync/{id}` | Синхронизировать источник |
| POST | `/api/knowledge/sync/all` | Синхронизировать всё |
| DELETE | `/api/knowledge-sources/{id}` | Удалить источник |

## 🐳 Dockerfile

```dockerfile
FROM gradle:8.13-jdk21 AS builder
WORKDIR /app
COPY . .
RUN gradle bootJar --no-daemon -x test

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar
EXPOSE 8080
CMD ["java", "-Dspring.profiles.active=docker", "-jar", "app.jar"]
```

## 🔧 Устранение неполадок

### Проблема: Приложение не подключается к PostgreSQL

**Решение:** Убедитесь, что PostgreSQL запущен:

```bash
docker ps | grep postgres
docker logs archassistant-postgres
```

### Проблема: Ollama не отвечает

**Решение:** Проверьте статус Ollama:

```bash
docker ps | grep ollama
docker logs archassistant-ollama
```

### Проблема: Модель не загружена

**Решение:** Загрузите модель вручную:

```bash
docker exec archassistant-ollama ollama pull qwen3:1.7b
docker exec archassistant-ollama ollama pull nomic-embed-text
```

### Проблема: Ошибка "Connection refused"

**Решение:** Проверьте сеть между контейнерами:

```bash
docker exec archassistant-app sh -c "nc -zv postgres 5432"
docker exec archassistant-app sh -c "nc -zv ollama 11434"
```

### Проблема: Ошибка аутентификации PostgreSQL

**Решение:** Проверьте пароли в `docker-compose.yml` и `application-docker.yml`:

```yaml
# В docker-compose.yml
POSTGRES_PASSWORD: postgres

# В application-docker.yml
DB_PASSWORD: postgres
```

## 👨‍💻 Авторы

Сафоев Далер, Балтинов Максим
``
1. **Убраны упоминания о внешнем доступе к PostgreSQL и Ollama** - теперь они доступны только внутри Docker-сети
2. **Исправлено название модели** с `qwen:1.7b-chat` на `qwen3:1.7b`
3. **Добавлено примечание** о том, что сервисы недоступны извне
4. **Обновлены команды проверки** - убраны прямые запросы к PostgreSQL и Ollama с хоста
5. **Добавлен curl для проверки приложения** вместо проверки БД