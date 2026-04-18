(function () {
    "use strict";

    let currentChatId = null;
    let currentEventSource = null;
    let isLoading = false;

    // DOM элементы
    const chatWindow = document.getElementById('chat-window');
    const loader = document.getElementById('loader');
    const stopBtn = document.getElementById('stop-stream-btn');
    const titleEl = document.getElementById('active-chat-title');
    const inputField = document.getElementById('user-input');
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const fileInput = document.getElementById('file-input');
    const fileInputDrop = document.getElementById('file-input-drop');
    const attachBtn = document.getElementById('attach-btn');
    const dropZone = document.getElementById('drop-zone');
    const fileIndicator = document.getElementById('file-indicator');
    const fileNameSpan = document.getElementById('file-name');
    const clearFileBtn = document.getElementById('clear-file');
    const validationPanel = document.getElementById('validation-panel');
    const showValidationBtn = document.getElementById('show-validation-btn');
    const violationsContent = document.getElementById('violations-content');
    const passedContent = document.getElementById('passed-content');
    const summaryContent = document.getElementById('summary-content');

    let uploadedFile = null;
    let uploadedDocumentId = null;
    let lastValidationResults = null;

    marked.setOptions({ breaks: true, gfm: true });

    // ---------- ТЕМА ----------
    function initTheme() {
        if (!themeToggle || !themeIcon) return;
        const savedTheme = localStorage.getItem('theme') || 'dark';
        if (savedTheme === 'light') {
            document.documentElement.classList.remove('dark');
            themeIcon.innerText = 'dark_mode';
        } else {
            document.documentElement.classList.add('dark');
            themeIcon.innerText = 'light_mode';
        }
    }
    if (themeToggle) {
        themeToggle.onclick = () => {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            themeIcon.innerText = isDark ? 'light_mode' : 'dark_mode';
        };
    }

    // ---------- DRAG & DROP ----------
    if (dropZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.body.addEventListener(eventName, (e) => e.preventDefault());
        });
        document.body.addEventListener('dragenter', () => dropZone.classList.remove('hidden'));
        dropZone.addEventListener('dragleave', () => dropZone.classList.add('hidden'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.add('hidden');
            const files = e.dataTransfer.files;
            if (files.length > 0) handleFileSelection(files[0]);
        });
        dropZone.addEventListener('dragover', () => dropZone.classList.remove('hidden'));
        dropZone.addEventListener('click', () => fileInputDrop?.click());
    }
    if (fileInputDrop) {
        fileInputDrop.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleFileSelection(e.target.files[0]);
        });
    }

    if (attachBtn) {
        attachBtn.addEventListener('click', () => fileInput?.click());
    }
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleFileSelection(e.target.files[0]);
        });
    }

    function handleFileSelection(file) {
        uploadedFile = file;
        uploadedDocumentId = null;
        if (fileNameSpan) fileNameSpan.textContent = file.name;
        if (fileIndicator) fileIndicator.classList.remove('hidden');
        if (inputField) inputField.placeholder = `Файл "${file.name}" прикреплён. Введите комментарий (необязательно)`;
    }

    function clearAttachedFile() {
        uploadedFile = null;
        uploadedDocumentId = null;
        if (fileIndicator) fileIndicator.classList.add('hidden');
        if (fileNameSpan) fileNameSpan.textContent = '';
        if (fileInput) fileInput.value = '';
        if (fileInputDrop) fileInputDrop.value = '';
        if (inputField) inputField.placeholder = 'Введите описание задачи или прикрепите файл...';
    }

    if (clearFileBtn) {
        clearFileBtn.addEventListener('click', clearAttachedFile);
    }

    // ---------- СВОРАЧИВАНИЕ СЕКЦИИ ЗНАНИЙ ----------
    window.toggleKnowledgeSection = function() {
        const section = document.getElementById('knowledge-section');
        const chevron = document.getElementById('knowledge-chevron');
        if (!section || !chevron) return;

        section.classList.toggle('collapsed');
        const isCollapsed = section.classList.contains('collapsed');
        chevron.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
    };

    // ---------- ЛОГИКА ЧАТОВ ----------
    async function loadChats() {
        try {
            const res = await fetch('/api/chats');
            if (!res.ok) throw new Error('Ошибка сети');
            const chats = await res.json();
            const list = document.getElementById('chat-list');
            if (!list) return;
            list.innerHTML = '';
            chats.forEach(chat => {
                const isActive = currentChatId === chat.id;
                const div = document.createElement('div');
                div.className = `p-3 rounded-xl cursor-pointer transition-all flex items-center gap-3 text-sm ${
                    isActive ? 'bg-[#0054a6] text-white shadow-md' : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/5'
                }`;
                div.innerHTML = `<span class="material-symbols-outlined text-[18px]">chat</span><span class="truncate">${chat.title || 'Без названия'}</span>`;
                div.onclick = () => selectChat(chat.id, chat.title);
                list.appendChild(div);
            });
        } catch (e) {
            console.error('Ошибка загрузки чатов:', e);
        }
    }

    async function selectChat(id, title) {
        currentChatId = id;
        if (titleEl) titleEl.innerText = title;
        if (chatWindow) chatWindow.innerHTML = '';
        try {
            const res = await fetch(`/api/messages/chat/${id}`);
            const messages = await res.json();
            messages.forEach(msg => appendMessage(msg.role, msg.content));
        } catch (e) {
            console.error('Ошибка загрузки сообщений:', e);
        }
        loadChats();
    }

    function appendMessage(role, content) {
        if (!chatWindow) return null;
        const wrapper = document.createElement('div');
        const isAI = role === 'assistant';
        wrapper.className = `flex ${isAI ? 'justify-start' : 'justify-end'} mb-4`;
        const htmlContent = isAI ? marked.parse(content) : content;

        const now = new Date();
        const timeString = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const fullDateTime = now.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        wrapper.innerHTML = `
            <div class="max-w-[85%]">
                <div class="flex items-center gap-2 mb-1 ${isAI ? '' : 'justify-end'}">
                    ${isAI ? '<span class="text-primary font-bold text-[10px] uppercase tracking-widest">ArchAssistant</span>' : ''}
                    <span class="text-[10px] text-gray-500 cursor-help" title="${fullDateTime}">${timeString}</span>
                </div>
                <div class="${isAI ? 'ai-content' : 'bg-primary p-4 rounded-2xl text-sm text-white border border-white/10 shadow-lg'}">
                    ${htmlContent}
                </div>
            </div>
        `;
        chatWindow.appendChild(wrapper);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        return isAI ? wrapper.querySelector('.ai-content') : null;
    }

    function setLoading(state) {
        isLoading = state;
        if (loader) loader.classList.toggle('hidden', !state);
        if (stopBtn) stopBtn.classList.toggle('hidden', !state);
        if (inputField) inputField.disabled = state;
        if (attachBtn) attachBtn.style.pointerEvents = state ? 'none' : 'auto';
    }

    window.stopStreaming = function() {
        if (currentEventSource) {
            currentEventSource.close();
            currentEventSource = null;
        }
        setLoading(false);
        clearAttachedFile();
    };

    // ---------- ПАНЕЛЬ РЕЗУЛЬТАТОВ ----------
    window.switchValidationTab = function(tab) {
        const tabs = ['violations', 'passed', 'summary'];
        tabs.forEach(t => {
            const tabBtn = document.getElementById(`tab-${t}`);
            const content = document.getElementById(`${t}-content`);
            if (t === tab) {
                tabBtn.classList.add('border-primary', 'text-primary');
                tabBtn.classList.remove('text-gray-500', 'hover:text-gray-300');
                content.classList.remove('hidden');
            } else {
                tabBtn.classList.remove('border-primary', 'text-primary');
                tabBtn.classList.add('text-gray-500', 'hover:text-gray-300');
                content.classList.add('hidden');
            }
        });
    };

    window.showValidationPanel = function() {
        if (validationPanel) {
            validationPanel.classList.remove('hidden');
            if (showValidationBtn) showValidationBtn.classList.add('hidden');
        }
    };

    window.closeValidationPanel = function() {
        if (validationPanel) {
            validationPanel.classList.add('hidden');
            if (showValidationBtn) showValidationBtn.classList.remove('hidden');
        }
    };

    // ---------- ПАРСИНГ ОТВЕТА AI (обновлённый) ----------
    function extractViolations(text) {
        const violations = [];

        // Ищем секцию "Нарушения"
        const sectionPatterns = [
            /Нарушения?\s*\n([\s\S]*?)(?=\nРекомендации|\nПозитив|\nОценка|$)/i,
            /(?:⚠️\s*)?Нарушения и проблемы?\s*\n([\s\S]*?)(?=\n[📋✅🟡]|\nРекомендации|\nПозитив|$)/i
        ];

        let violationsText = '';
        for (const pattern of sectionPatterns) {
            const match = text.match(pattern);
            if (match) {
                violationsText = match[1];
                break;
            }
        }

        if (!violationsText) {
            console.warn('Секция нарушений не найдена');
            return violations;
        }

        // Парсим нумерованные и ненумерованные нарушения
        const lines = violationsText.split('\n');
        let currentCategory = '';
        let currentViolation = null;

        for (let line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Определяем категорию (1. Несоответствие ГОСТ...)
            const categoryMatch = trimmed.match(/^(\d+)\.\s*(.+?)(?::|$)/);
            if (categoryMatch) {
                // Сохраняем предыдущее нарушение
                if (currentViolation) {
                    violations.push(currentViolation);
                }
                currentCategory = categoryMatch[2].trim();
                currentViolation = {
                    code: `Н-${categoryMatch[1]}`,
                    category: currentCategory,
                    criteria: currentCategory,
                    description: '',
                    recommendation: ''
                };
                continue;
            }

            // Подпункты (начинаются с - или • или ❌ или ⚠️)
            const subMatch = trimmed.match(/^[-•❌⚠️]\s*(.+)$/);
            if (subMatch && currentViolation) {
                const subText = subMatch[1].trim();
                // Разделяем на описание и рекомендацию если есть двоеточие
                const colonIndex = subText.indexOf(':');
                if (colonIndex > 0) {
                    const title = subText.substring(0, colonIndex).trim();
                    const desc = subText.substring(colonIndex + 1).trim();
                    currentViolation.description += (currentViolation.description ? '\n' : '') + `• ${title}: ${desc}`;
                } else {
                    currentViolation.description += (currentViolation.description ? '\n' : '') + `• ${subText}`;
                }
                continue;
            }

            // Обычный текст (продолжение описания)
            if (currentViolation && !trimmed.match(/^\d+\./)) {
                currentViolation.description += ' ' + trimmed;
            }
        }

        // Добавляем последнее нарушение
        if (currentViolation) {
            violations.push(currentViolation);
        }

        // Для каждого нарушения ищем рекомендацию
        violations.forEach(v => {
            v.recommendation = extractRecommendationForViolation(text, v);
            // Если описание слишком длинное для заголовка
            if (v.description && v.description.length > 100) {
                v.criteria = v.category;
            } else {
                v.criteria = v.description || v.category;
            }
        });

        return violations;
    }

    function extractRecommendationForViolation(fullText, violation) {
        // Ищем секцию с рекомендациями
        const recSection = fullText.match(/Рекомендации?\s*\n([\s\S]*?)(?=\nПозитив|\nОценка|$)/i);
        if (!recSection) return 'См. полный отчёт для рекомендаций';

        const recContent = recSection[1];

        // Ищем соответствующий пункт рекомендаций (1. Привести документацию...)
        const recNumber = violation.code.replace('Н-', '');
        const recPattern = new RegExp(`${recNumber}\\.\\s*([^\\n]+(?:\\n(?!\\d+\\.)[^\\n]+)*)`, 'i');
        const recMatch = recContent.match(recPattern);

        if (recMatch) {
            // Извлекаем все подпункты
            let recText = recMatch[1];
            const subRecs = [];
            const lines = recText.split('\n');

            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.match(/^[-•]/)) {
                    subRecs.push(trimmed.replace(/^[-•]\s*/, ''));
                }
            }

            if (subRecs.length > 0) {
                return subRecs.join('; ');
            }
            return recText.trim();
        }

        // Ищем по ключевым словам из категории
        const keywords = violation.category.toLowerCase().split(/\s+/).filter(w => w.length > 4);
        const recLines = recContent.split('\n');

        for (const line of recLines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.match(/^\d+\./)) continue;

            const lineLower = trimmed.toLowerCase();
            let matchCount = 0;
            keywords.forEach(kw => {
                if (lineLower.includes(kw)) matchCount++;
            });

            if (matchCount >= 2) {
                return trimmed.replace(/^[-•]\s*/, '');
            }
        }

        return 'Детальные рекомендации см. в разделе "Рекомендации" полного отчёта';
    }

    function extractPassed(text) {
        const passed = [];

        // Ищем секцию "Позитив"
        const sectionPatterns = [
            /Позитив(?:ные аспекты)?\s*\n([\s\S]*?)(?=\nОценка|\nЗаключение|$)/i,
            /(?:✅\s*)?Позитив(?:ные моменты)?\s*\n([\s\S]*?)(?=\n[📊⚠️🟡]|\nОценка|$)/i
        ];

        let passedText = '';
        for (const pattern of sectionPatterns) {
            const match = text.match(pattern);
            if (match) {
                passedText = match[1];
                break;
            }
        }

        if (!passedText) {
            // Ищем строки с ✅ по всему тексту
            const positiveLines = text.match(/✅[^\n]+/g);
            if (positiveLines) {
                positiveLines.forEach(line => {
                    const cleanLine = line.replace(/^✅\s*/, '').trim();
                    if (cleanLine.length > 10) {
                        // Разделяем на категорию и описание
                        const colonIndex = cleanLine.indexOf(':');
                        if (colonIndex > 0) {
                            passed.push({
                                category: cleanLine.substring(0, colonIndex).trim(),
                                criteria: cleanLine.substring(0, 100),
                                description: cleanLine.substring(colonIndex + 1).trim()
                            });
                        } else {
                            passed.push({
                                category: 'Позитивный момент',
                                criteria: cleanLine.substring(0, 100),
                                description: cleanLine
                            });
                        }
                    }
                });
            }
            return passed;
        }

        // Парсим строки
        const lines = passedText.split('\n');
        let currentItem = null;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Новый пункт (начинается с ✅ или названия)
            if (trimmed.includes('✅') || trimmed.match(/^[А-Я][а-я]+:/)) {
                if (currentItem) {
                    passed.push(currentItem);
                }

                const cleanLine = trimmed.replace(/^✅\s*/, '');
                const colonIndex = cleanLine.indexOf(':');

                if (colonIndex > 0) {
                    currentItem = {
                        category: cleanLine.substring(0, colonIndex).trim(),
                        criteria: cleanLine.substring(0, 100),
                        description: cleanLine.substring(colonIndex + 1).trim()
                    };
                } else {
                    currentItem = {
                        category: 'Позитивный момент',
                        criteria: cleanLine.substring(0, 100),
                        description: cleanLine
                    };
                }
            } else if (currentItem) {
                // Продолжение описания
                currentItem.description += ' ' + trimmed;
            }
        }

        if (currentItem) {
            passed.push(currentItem);
        }

        return passed;
    }

    function extractMaturity(text) {
        // Ищем уровень зрелости
        const patterns = [
            /Уровень зрелости:\s*(\d+)\s*(?:\([^)]+\))?\s*\n([\s\S]*?)(?=\n\n|$)/i,
            /Оценка зрелости[^:]*:\s*(\d+)\s*(?:\([^)]+\))?/i,
            /Уровень\s*(\d+)\s*\([^)]+\)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return {
                    level: parseInt(match[1]),
                    description: match[2] ? match[2].trim().substring(0, 200) : 'Уровень определён'
                };
            }
        }

        return { level: 2, description: 'Требуется оценка' };
    }

    function extractSummary(text) {
        // Ищем итог
        const patterns = [
            /Итог\s*\n([^\n]+(?:\n[^\n]+){0,2})/i,
            /🟡\s*Итог\s*\n([^\n]+)/i,
            /##\s*Итог\s*\n([^\n]+)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1].trim().replace(/\n/g, ' ');
            }
        }

        // Первое предложение как итог
        const firstLine = text.split('\n')[0];
        if (firstLine && firstLine.length > 20) {
            return firstLine;
        }

        return 'Проверка завершена';
    }

    function extractConclusion(text) {
        // Ищем заключение или вывод
        const patterns = [
            /Заключение\s*\n([^\n]+(?:\n[^\n]+){0,3})/i,
            /Вывод:?\s*\n([^\n]+)/i,
            /Рекомендации по повышению зрелости[:\s]*\n([\s\S]*?)(?=\n\n|$)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1].trim().replace(/\n/g, ' ');
            }
        }

        return '';
    }

    function parseAndDisplayValidationResults(responseText) {
        if (!violationsContent || !passedContent || !summaryContent) return;

        lastValidationResults = responseText;

        violationsContent.innerHTML = '';
        passedContent.innerHTML = '';
        summaryContent.innerHTML = '';

        const violations = extractViolations(responseText);
        const passed = extractPassed(responseText);
        const maturity = extractMaturity(responseText);
        const summary = extractSummary(responseText);
        const conclusion = extractConclusion(responseText);

        if (violations.length === 0) {
            violationsContent.innerHTML = '<p class="text-green-500 text-sm text-center py-4">✅ Нарушений не обнаружено</p>';
        } else {
            violations.forEach(v => violationsContent.appendChild(createViolationCard(v)));
        }

        if (passed.length === 0) {
            passedContent.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">Позитивные моменты не выделены</p>';
        } else {
            passed.forEach(p => passedContent.appendChild(createPassedCard(p)));
        }

        summaryContent.innerHTML = createSummaryHTML(violations.length, passed.length, maturity, summary, conclusion);

        if (showValidationBtn) showValidationBtn.classList.remove('hidden');
        showValidationPanel();
    }

    function createViolationCard(violation) {
        const card = document.createElement('div');
        card.className = 'criteria-card violation';

        const codeDisplay = violation.code ? `<span class="font-mono text-xs text-primary mr-2">[${violation.code}]</span>` : '';

        card.innerHTML = `
            <div class="criteria-title">
                <span class="material-symbols-outlined text-red-500">error</span>
                ${codeDisplay}
                <span>${escapeHtml(violation.criteria)}</span>
            </div>
            <div class="criteria-description">${escapeHtml(violation.description)}</div>
            <div class="recommendation">
                <strong class="text-primary flex items-center gap-1">
                    <span class="material-symbols-outlined text-sm">lightbulb</span>
                    Рекомендация:
                </strong>
                <div class="mt-1">${escapeHtml(violation.recommendation)}</div>
            </div>
        `;
        return card;
    }

    function createPassedCard(item) {
        const card = document.createElement('div');
        card.className = 'criteria-card passed';
        card.innerHTML = `
            <div class="criteria-title">
                <span class="material-symbols-outlined text-green-500">check_circle</span>
                <span class="text-xs text-gray-500">${escapeHtml(item.category)}</span>
            </div>
            <div class="criteria-description">${escapeHtml(item.description)}</div>
        `;
        return card;
    }

    function createSummaryHTML(violationsCount, passedCount, maturity, summary, conclusion) {
        const total = violationsCount + passedCount;
        const score = total > 0 ? Math.round((passedCount / total) * 100) : 0;

        return `
            <div class="space-y-4">
                <div class="text-center py-4">
                    <div class="text-4xl font-bold ${score >= 70 ? 'text-green-500' : score >= 40 ? 'text-yellow-500' : 'text-red-500'}">${score}%</div>
                    <div class="text-sm text-gray-500 mt-1">${escapeHtml(summary)}</div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-green-500/10 p-4 rounded-xl text-center">
                        <div class="text-2xl font-bold text-green-500">${passedCount}</div>
                        <div class="text-xs text-gray-500">Пройдено</div>
                    </div>
                    <div class="bg-red-500/10 p-4 rounded-xl text-center">
                        <div class="text-2xl font-bold text-red-500">${violationsCount}</div>
                        <div class="text-xs text-gray-500">Нарушений</div>
                    </div>
                </div>
                <div class="bg-primary/10 p-4 rounded-xl text-center">
                    <div class="text-sm text-gray-400">Уровень зрелости</div>
                    <div class="text-xl font-bold text-primary">${maturity.level}/5</div>
                    <div class="text-xs text-gray-500 mt-1">${escapeHtml(maturity.description)}</div>
                </div>
                ${conclusion ? `
                <div class="bg-surface-container-high/50 p-4 rounded-xl border border-outline-variant">
                    <div class="text-xs text-gray-400 mb-1">Заключение</div>
                    <div class="text-sm">${escapeHtml(conclusion)}</div>
                </div>
                ` : ''}
            </div>
        `;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ---------- ПРОВЕРКА РЕШЕНИЯ ----------
    window.validateSolution = async function() {
        const comment = inputField?.value.trim() || '';

        if (!currentChatId) {
            const shouldCreate = confirm('Проект не выбран. Создать новый?');
            if (!shouldCreate) return;
            try {
                const title = comment || uploadedFile?.name || 'Новый проект';
                const res = await fetch('/api/chats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: title.slice(0, 50) })
                });
                const chat = await res.json();
                currentChatId = chat.id;
                if (titleEl) titleEl.innerText = chat.title;
                if (chatWindow) chatWindow.innerHTML = '';
                loadChats();
            } catch (e) {
                alert('Не удалось создать проект');
                console.error(e);
                return;
            }
        }

        if (uploadedFile && !uploadedDocumentId) {
            try {
                appendMessage('user', `📎 Загрузка файла "${uploadedFile.name}"...`);
                const formData = new FormData();
                formData.append('file', uploadedFile);
                const uploadRes = await fetch(`/api/documents/upload/${currentChatId}`, {
                    method: 'POST',
                    body: formData
                });
                const uploadData = await uploadRes.json();
                if (!uploadData.success) throw new Error(uploadData.message || 'Ошибка загрузки');
                uploadedDocumentId = uploadData.documentId;
                chatWindow?.lastChild?.remove();
            } catch (err) {
                alert(`Ошибка загрузки файла: ${err.message}`);
                return;
            }
        }

        let userDisplayText = comment || 'Проверка решения';
        if (uploadedFile) {
            userDisplayText = `📄 **Файл:** ${uploadedFile.name}` + (comment ? `\n\n**Комментарий:** ${comment}` : '');
        }
        appendMessage('user', userDisplayText);

        if (inputField) {
            inputField.value = '';
            inputField.style.height = 'auto';
        }

        try {
            await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: currentChatId, role: 'user', content: userDisplayText })
            });
        } catch (e) {}

        const aiContainer = appendMessage('assistant', '');
        if (!aiContainer) return;

        setLoading(true);
        let fullText = '';

        let url;
        if (uploadedDocumentId) {
            url = `/api/ai/validate/document/${uploadedDocumentId}?message=${encodeURIComponent(comment)}&chatId=${currentChatId}`;
        } else {
            url = `/api/ai/validate?solution=${encodeURIComponent(comment)}&chatId=${currentChatId}`;
        }

        currentEventSource = new EventSource(url);

        currentEventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                fullText += data.content || '';
            } catch {
                fullText += event.data;
            }
            aiContainer.innerHTML = marked.parse(fullText);
            if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
        };

        currentEventSource.onerror = (event) => {
            currentEventSource.close();
            setLoading(false);
            if (fullText) {
                fetch('/api/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chatId: currentChatId, role: 'assistant', content: fullText })
                });
                parseAndDisplayValidationResults(fullText);
            } else {
                aiContainer.innerHTML = marked.parse('⚠️ **Ошибка:** не удалось получить ответ от сервера.');
            }
            clearAttachedFile();
        };
    };

    window.handleAction = async function(endpoint, paramName) {
        const text = inputField?.value.trim();
        if (!text || !currentChatId || isLoading) return;
        appendMessage('user', text);
        if (inputField) {
            inputField.value = '';
            inputField.style.height = 'auto';
        }
        try {
            await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: currentChatId, role: 'user', content: text })
            });
        } catch (e) {}
        const aiContainer = appendMessage('assistant', '');
        setLoading(true);
        let fullText = '';
        const url = `${endpoint}?${paramName}=${encodeURIComponent(text)}&chatId=${currentChatId}`;
        currentEventSource = new EventSource(url);
        currentEventSource.onmessage = (e) => {
            try { fullText += JSON.parse(e.data).content || ''; }
            catch { fullText += e.data; }
            aiContainer.innerHTML = marked.parse(fullText);
            if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
        };
        currentEventSource.onerror = () => {
            currentEventSource.close();
            setLoading(false);
            if (fullText) {
                fetch('/api/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chatId: currentChatId, role: 'assistant', content: fullText })
                });
            }
        };
    };

    window.createNewChat = async function() {
        const title = prompt("Введите название задачи:");
        if (!title) return;
        const res = await fetch('/api/chats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });
        const chat = await res.json();
        selectChat(chat.id, chat.title);
    };

    if (inputField) {
        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAction('/api/ai/stream', 'message');
            }
        });
    }

    // ---------- УПРАВЛЕНИЕ ИСТОЧНИКАМИ ЗНАНИЙ ----------
    const STORAGE_KEY = 'knowledge_sources_names';
    const sourceModal = document.getElementById('source-modal');
    const sourceUrl = document.getElementById('source-url');
    const sourceBranch = document.getElementById('source-branch');
    const sourcePath = document.getElementById('source-path');
    const sourceDisplayName = document.getElementById('source-display-name');

    async function loadKnowledgeSources() {
        try {
            const res = await fetch('/api/knowledge-sources');
            if (!res.ok) throw new Error('Ошибка загрузки источников');
            const sources = await res.json();
            renderSourcesList(sources);
        } catch (e) {
            console.error('Не удалось загрузить источники:', e);
        }
    }

    function renderSourcesList(sources) {
        const container = document.getElementById('knowledge-sources-list');
        if (!container) return;

        const namesMap = getLocalNamesMap();

        if (sources.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-xs text-center py-2">Нет добавленных источников</p>';
            return;
        }

        container.innerHTML = sources.map(source => {
            const displayName = namesMap[source.id] || source.repositoryUrl.split('/').pop() || 'Источник';
            return `
            <div class="group flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-all border border-outline-variant/50">
                <div class="flex items-center gap-2 overflow-hidden">
                    <span class="material-symbols-outlined text-gray-400 text-base">folder</span>
                    <span class="truncate" title="${source.repositoryUrl}">${escapeHtml(displayName)}</span>
                </div>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="syncKnowledgeSource('${source.id}')" class="p-1 hover:bg-primary/20 rounded" title="Синхронизировать">
                        <span class="material-symbols-outlined text-sm">sync</span>
                    </button>
                    <button onclick="deleteKnowledgeSource('${source.id}')" class="p-1 hover:bg-red-500/20 rounded text-red-400" title="Удалить">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                </div>
            </div>
        `;
        }).join('');
    }

    function getLocalNamesMap() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        } catch {
            return {};
        }
    }

    function saveLocalName(sourceId, name) {
        const map = getLocalNamesMap();
        map[sourceId] = name;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    }

    function removeLocalName(sourceId) {
        const map = getLocalNamesMap();
        delete map[sourceId];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    }

    window.openAddSourceModal = function() {
        if (sourceModal) {
            sourceModal.classList.remove('hidden');
            if (sourceUrl) sourceUrl.value = '';
            if (sourceBranch) sourceBranch.value = 'main';
            if (sourcePath) sourcePath.value = '';
            if (sourceDisplayName) sourceDisplayName.value = '';
        }
    };

    window.closeSourceModal = function() {
        if (sourceModal) sourceModal.classList.add('hidden');
    };

    window.addKnowledgeSource = async function() {
        const url = sourceUrl?.value.trim();
        if (!url) {
            alert('Введите URL репозитория');
            return;
        }
        const branch = sourceBranch?.value.trim() || 'main';
        const localPath = sourcePath?.value.trim() || '/knowledge';
        const displayName = sourceDisplayName?.value.trim() || url.split('/').pop() || 'Источник';

        try {
            const res = await fetch('/api/knowledge-sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repositoryUrl: url, branch, localPath })
            });
            if (!res.ok) throw new Error('Ошибка создания источника');
            const data = await res.json();

            saveLocalName(data.id, displayName);
            closeSourceModal();
            await loadKnowledgeSources();
            alert(`Источник "${displayName}" добавлен.`);
        } catch (e) {
            alert('Не удалось добавить источник: ' + e.message);
            console.error(e);
        }
    };

    window.syncKnowledgeSource = async function(sourceId) {
        const btn = event.currentTarget;
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">sync</span>';
        btn.disabled = true;

        try {
            const res = await fetch(`/api/knowledge/sync/${sourceId}`, { method: 'POST' });
            const data = await res.json();
            alert(data.message || 'Синхронизация завершена');
        } catch (e) {
            alert('Ошибка синхронизации: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    };

    window.syncAllKnowledgeSources = async function(event) {
        const btn = event.currentTarget;
        btn.disabled = true;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Синхронизация...';

        try {
            const res = await fetch('/api/knowledge/sync/all', { method: 'POST' });
            const data = await res.json();
            alert(data.message || 'Синхронизация завершена');
        } catch (e) {
            alert('Ошибка синхронизации: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    };

    window.deleteKnowledgeSource = async function(sourceId) {
        if (!confirm('Удалить источник знаний? Это также удалит все связанные данные из базы.')) return;

        try {
            const res = await fetch(`/api/knowledge-sources/${sourceId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Ошибка удаления');
            removeLocalName(sourceId);
            await loadKnowledgeSources();
        } catch (e) {
            alert('Не удалось удалить источник: ' + e.message);
        }
    };

    if (sourceModal) {
        sourceModal.addEventListener('click', (e) => {
            if (e.target === sourceModal) closeSourceModal();
        });
    }

    // ---------- СВОРАЧИВАНИЕ БОКОВОЙ ПАНЕЛИ ----------
    const sidebar = document.querySelector('aside');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const sidebarToggleIcon = document.getElementById('sidebar-toggle-icon');

    function initSidebarState() {
        const savedState = localStorage.getItem('sidebar_collapsed');
        if (savedState === 'true') {
            sidebar.classList.add('sidebar-collapsed');
            sidebarToggleIcon.textContent = 'menu';
        } else {
            sidebar.classList.remove('sidebar-collapsed');
            sidebarToggleIcon.textContent = 'menu_open';
        }
    }

    if (toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener('click', () => {
            sidebar.classList.toggle('sidebar-collapsed');
            const isCollapsed = sidebar.classList.contains('sidebar-collapsed');
            localStorage.setItem('sidebar_collapsed', isCollapsed);
            sidebarToggleIcon.textContent = isCollapsed ? 'menu' : 'menu_open';
        });
    }

    // Инициализация
    initTheme();
    loadChats();
    loadKnowledgeSources();
    initSidebarState();
})();