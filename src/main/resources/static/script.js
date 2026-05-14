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

            // Сортируем: закреплённые сверху, затем по дате создания
            const pinnedChats = chats.filter(c => c.pinned);
            const unpinnedChats = chats.filter(c => !c.pinned);
            const sortedChats = [...pinnedChats, ...unpinnedChats];

            list.innerHTML = '';
            sortedChats.forEach(chat => {
                const isActive = currentChatId === chat.id;
                const div = document.createElement('div');

                // Базовые классы для контейнера чата
                let className = 'chat-item group p-3 rounded-xl transition-all flex items-center justify-between text-sm cursor-pointer ';

                if (isActive) {
                    className += 'bg-[#0054a6] text-white shadow-md active-chat';
                } else {
                    className += 'text-gray-500 dark:text-white hover:bg-black/5 dark:hover:bg-white/5';
                }

                div.className = className;
                div.setAttribute('data-chat-id', chat.id);

                // Вся строка чата кликабельна для выбора чата
                div.onclick = (e) => {
                    e.stopPropagation();
                    selectChat(chat.id, chat.title);
                };

                // Экранируем标题 для безопасности
                const safeTitle = escapeHtml(chat.title || 'Без названия').replace(/'/g, "\\'");

                // Контент внутри
                div.innerHTML = `
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    <span class="material-symbols-outlined text-[18px] flex-shrink-0">${chat.pinned ? 'push_pin' : 'chat'}</span>
                    <span class="truncate chat-title flex-1">${safeTitle}</span>
                </div>
                <div class="flex-shrink-0">
                    <button class="chat-menu-btn" 
                            style="background: transparent !important; border: none !important; padding: 0; margin: 0; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0;"
                            onmouseenter="this.style.opacity='1'"
                            onmouseleave="this.style.opacity='0'"
                            onclick="event.stopPropagation(); window.showChatMenu(event, '${chat.id}', '${safeTitle}')">
                        <span class="material-symbols-outlined" style="font-size: 18px; color: ${isActive ? 'rgba(255,255,255,0.8)' : '#9ca3af'};">more_vert</span>
                    </button>
                </div>
            `;

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

        // Обновляем активный класс во всех чатах
        const allChats = document.querySelectorAll('.chat-item');
        allChats.forEach(chat => {
            if (chat.getAttribute('data-chat-id') == id) {
                chat.classList.add('active-chat');
                chat.classList.add('bg-[#0054a6]', 'text-white', 'shadow-md');
                chat.classList.remove('text-gray-500', 'dark:text-white', 'hover:bg-black/5', 'dark:hover:bg-white/5');
                // Обновляем стиль кнопки меню
                const menuBtn = chat.querySelector('.chat-menu-btn');
                if (menuBtn) {
                    menuBtn.classList.add('text-white/70', 'hover:text-white');
                }
            } else {
                chat.classList.remove('active-chat');
                chat.classList.remove('bg-[#0054a6]', 'text-white', 'shadow-md');
                chat.classList.add('text-gray-500', 'dark:text-white', 'hover:bg-black/5', 'dark:hover:bg-white/5');
                // Обновляем стиль кнопки меню
                const menuBtn = chat.querySelector('.chat-menu-btn');
                if (menuBtn) {
                    menuBtn.classList.remove('text-white/70', 'hover:text-white');
                    menuBtn.classList.add('text-gray-400', 'hover:text-white');
                }
            }
        });

        try {
            const res = await fetch(`/api/messages/chat/${id}`);
            const messages = await res.json();
            let lastValidationReport = null;
            messages.forEach(msg => {
                appendMessage(msg.role, msg.content);
                if (msg.role === 'assistant' && looksLikeValidationReport(msg.content)) {
                    lastValidationReport = msg.content;
                }
            });
            if (lastValidationReport) {
                parseAndDisplayValidationResults(lastValidationReport, { openPanel: false });
            } else {
                resetValidationPanel();
            }
        } catch (e) {
            console.error('Ошибка загрузки сообщений:', e);
        }
        loadChats();
    }

    function normalizeAssistantMarkdown(content) {
        let text = (content || '')
            .replace(/\r\n?/g, '\n')
            .trim();

        text = unwrapMarkdownFence(text);
        text = dedentMarkdown(text);
        return unwrapMarkdownFence(text).trim();
    }

    function unwrapMarkdownFence(text) {
        const match = text.match(/^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n```\s*$/i);
        return match ? match[1].trim() : text;
    }

    function dedentMarkdown(text) {
        const lines = text.split('\n');
        const indents = lines
            .filter(line => line.trim())
            .map(line => (line.match(/^[ \t]*/) || [''])[0].replace(/\t/g, '    ').length);

        if (!indents.length) return text;
        const minIndent = Math.min(...indents);
        if (minIndent < 4) return text;

        return lines
            .map(line => line.trim() ? line.slice(Math.min(minIndent, line.length)) : '')
            .join('\n')
            .trim();
    }

    function renderAssistantMarkdown(container, content) {
        if (!container) return;
        container.innerHTML = marked.parse(normalizeAssistantMarkdown(content));
    }

    function appendMessage(role, content) {
        if (!chatWindow) return null;
        const wrapper = document.createElement('div');
        const isAI = role === 'assistant';
        wrapper.className = `flex ${isAI ? 'justify-start' : 'justify-end'} mb-4`;
        const htmlContent = isAI ? marked.parse(normalizeAssistantMarkdown(content)) : content;

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
            <div class="max-w-[85%] min-w-0">
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
            if (!tabBtn || !content) return;
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

    // ---------- ПАРСИНГ ОТВЕТА AI НА КЛИЕНТЕ ----------
    const EMPTY_VALIDATION_HTML = '<p class="text-gray-500 text-sm text-center py-4">Нет данных проверки</p>';

    const SECTION_ALIASES = {
        summary: ['итог', 'сводка', 'результат проверки', 'общий результат', 'общая оценка', 'вердикт'],
        violations: ['нарушения', 'нарушение', 'несоответствия', 'несоответствие', 'проблемы', 'замечания', 'риски', 'ошибки'],
        recommendations: ['рекомендации', 'рекомендация', 'что исправить', 'план исправлений', 'меры'],
        passed: ['пройдено', 'пройденные проверки', 'пройденные тесты', 'успешные проверки', 'позитив', 'положительные моменты', 'соответствует', 'выполнено'],
        maturity: ['оценка зрелости', 'уровень зрелости', 'зрелость', 'оценка']
    };

    const NO_VIOLATIONS_RE = /(нарушени[йя]\s+(?:не\s+)?(?:обнаружено|найдено|выявлено)|нет\s+нарушений|нарушения\s+отсутствуют|несоответствия\s+не\s+выявлены)/i;
    const NO_PASSED_RE = /(пройденн(?:ые|ых)\s+(?:проверки|тесты)\s+(?:не\s+)?(?:выделены|найдены|обнаружены)|нет\s+пройденных|позитивные\s+моменты\s+не\s+выделены)/i;

    function normalizeReportText(text) {
        return (text || '')
            .replace(/\r\n?/g, '\n')
            .replace(/\u00a0/g, ' ')
            .replace(/[ \t]+$/gm, '')
            .trim();
    }

    function stripMarkdownSyntax(value) {
        return (value || '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/`{1,3}/g, '')
            .replace(/\*\*/g, '')
            .replace(/__/g, '')
            .replace(/~~/g, '')
            .replace(/^\s{0,3}#{1,6}\s*/, '')
            .replace(/^\s*>\s*/, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function stripLeadingIcon(value) {
        return value
            .replace(/^[^A-Za-zА-Яа-яЁё0-9]+/, '')
            .trim();
    }

    function isListItem(line) {
        return /^\s*(?:[-*•]\s+|[✅❌⚠️]\s*|\d+[\).]\s+|\[[^\]]+\]\s*)/.test(line);
    }

    function getSectionKey(title) {
        const normalized = stripLeadingIcon(stripMarkdownSyntax(title))
            .replace(/^\d+[\).]\s*/, '')
            .toLowerCase()
            .replace(/[:：]\s*$/, '');
        if (!normalized || normalized.length > 90) return null;

        for (const [key, aliases] of Object.entries(SECTION_ALIASES)) {
            if (aliases.some(alias => normalized === alias || normalized.startsWith(`${alias}:`) || normalized.includes(alias))) {
                return key;
            }
        }
        return null;
    }

    function parseSectionHeading(line) {
        const trimmed = line.trim();
        if (!trimmed) return null;

        const withoutHeadingMarker = stripMarkdownSyntax(trimmed);
        const numberedHeadingText = withoutHeadingMarker.replace(/^\d+[\).]\s*/, '');
        const inlineMatch = withoutHeadingMarker.match(/^(.{3,70}?):\s*(.*)$/);
        const title = inlineMatch ? inlineMatch[1] : numberedHeadingText;
        const key = getSectionKey(title);

        if (!key) return null;
        const isNumberedHeading = /^\d+[\).]\s+/.test(withoutHeadingMarker) && numberedHeadingText.length <= 70 && getSectionKey(numberedHeadingText);
        if (isListItem(trimmed) && !isNumberedHeading) return null;

        const looksLikeHeading = /^#{1,6}\s/.test(trimmed) || /\*\*.+\*\*/.test(trimmed) || inlineMatch || withoutHeadingMarker.length <= 70 || isNumberedHeading;
        if (!looksLikeHeading) return null;

        return {
            key,
            rest: inlineMatch ? inlineMatch[2].trim() : ''
        };
    }

    function splitReportIntoSections(text) {
        const sections = {
            preamble: [],
            summary: [],
            violations: [],
            recommendations: [],
            passed: [],
            maturity: []
        };
        let current = 'preamble';

        normalizeReportText(text).split('\n').forEach(line => {
            const heading = parseSectionHeading(line);
            if (heading) {
                current = heading.key;
                if (heading.rest) sections[current].push(heading.rest);
                return;
            }
            sections[current].push(line);
        });

        return sections;
    }

    function cleanItemText(line) {
        return stripMarkdownSyntax(line)
            .replace(/^\s*(?:[-*•]\s*)/, '')
            .replace(/^[✅❌⚠️]\s*/, '')
            .replace(/^\s*\[([^\]]+)\]\s*/, '$1 ')
            .trim();
    }

    function stripNumberPrefix(line) {
        const match = line.match(/^(\d+)[\).]\s*(.*)$/);
        return match ? { number: match[1], text: match[2].trim() } : { number: null, text: line };
    }

    function splitTitleAndDescription(text, defaultCategory) {
        const normalized = text.trim();
        const colonIndex = normalized.indexOf(':');
        if (colonIndex > 0 && colonIndex <= 90) {
            return {
                category: normalized.slice(0, colonIndex).trim(),
                description: normalized.slice(colonIndex + 1).trim() || normalized.slice(0, colonIndex).trim()
            };
        }

        const dashMatch = normalized.match(/^(.{3,90}?)\s+[—-]\s+(.+)$/);
        if (dashMatch) {
            return {
                category: dashMatch[1].trim(),
                description: dashMatch[2].trim()
            };
        }

        return {
            category: defaultCategory,
            description: normalized
        };
    }

    function isDetailLabel(line) {
        return /^(описание|проблема|причина|критерий|стандарт|требование|влияние|риск|детали)\s*:/i.test(line);
    }

    function extractDetailText(line) {
        return line.replace(/^[^:]+:\s*/i, '').trim();
    }

    function isRecommendationLabel(line) {
        return /^(рекомендац(?:ия|ии)|исправить|что сделать|решение|как исправить)\s*:/i.test(line);
    }

    function buildValidationItem(rawLine, type, index, markerType) {
        let cleanLine = cleanItemText(rawLine);
        const numbered = stripNumberPrefix(cleanLine);
        cleanLine = numbered.text;

        const codeMatch = cleanLine.match(/^((?:Н|П|T|TEST|STD|REQ|CR)[-\s]?\d+)\s*[:.)-]?\s*(.*)$/i);
        const code = codeMatch ? codeMatch[1].replace(/\s+/g, '-').toUpperCase() : null;
        if (codeMatch) cleanLine = codeMatch[2].trim() || codeMatch[1];

        const defaultCategory = type === 'violation' ? 'Нарушение стандарта' : 'Пройденная проверка';
        const split = splitTitleAndDescription(cleanLine, defaultCategory);
        const fallbackNumber = numbered.number || String(index + 1);
        const criteria = split.category === defaultCategory && split.description.length <= 120
            ? split.description
            : split.category;

        return {
            code: code || (type === 'violation' ? `Н-${fallbackNumber}` : `П-${fallbackNumber}`),
            category: split.category || defaultCategory,
            criteria: criteria || defaultCategory,
            description: split.description || cleanLine || defaultCategory,
            recommendation: '',
            markerType
        };
    }

    function appendItemDetail(item, detail) {
        if (!detail) return;
        item.description = item.description
            ? `${item.description}\n${detail}`
            : detail;
    }

    function parseTableItems(text, type) {
        const items = [];
        const lines = normalizeReportText(text).split('\n').filter(line => line.includes('|'));

        lines.forEach(line => {
            const cells = line.split('|').map(cell => stripMarkdownSyntax(cell)).filter(Boolean);
            if (cells.length < 2 || cells.every(cell => /^[-:]+$/.test(cell))) return;

            const rowText = cells.join(' ');
            const isViolation = /❌|⚠️|наруш|не\s+соответ|fail|failed|ошибка|проблем/i.test(rowText);
            const isPassed = /✅|пройден|соответствует|pass|passed|ok|выполн/i.test(rowText) && !isViolation;

            if ((type === 'violation' && !isViolation) || (type === 'passed' && !isPassed)) return;

            const usefulCells = cells.filter(cell => !/^(статус|результат|✅|❌|⚠️|пройдено|нарушение)$/i.test(cell));
            const category = usefulCells[0] || (type === 'violation' ? 'Нарушение стандарта' : 'Пройденная проверка');
            const description = usefulCells.slice(1).join(' · ') || rowText;

            items.push({
                code: `${type === 'violation' ? 'Н' : 'П'}-${items.length + 1}`,
                category,
                criteria: category,
                description,
                recommendation: ''
            });
        });

        return items;
    }

    function parseListItems(sectionText, type) {
        const items = [];
        const tableItems = parseTableItems(sectionText, type);
        const lines = normalizeReportText(sectionText).split('\n');
        let current = null;

        function pushCurrent() {
            if (!current) return;
            current.description = stripMarkdownSyntax(current.description);
            current.recommendation = stripMarkdownSyntax(current.recommendation);
            if (current.description.length > 0) items.push(current);
            current = null;
        }

        lines.forEach(rawLine => {
            const trimmed = rawLine.trim();
            if (!trimmed || /^\|?[-:\s|]+\|?$/.test(trimmed)) return;

            const cleanLine = cleanItemText(trimmed);
            if (!cleanLine || NO_VIOLATIONS_RE.test(cleanLine) || NO_PASSED_RE.test(cleanLine)) return;

            if (current && isRecommendationLabel(cleanLine)) {
                current.recommendation = [current.recommendation, extractDetailText(cleanLine)].filter(Boolean).join(' ');
                return;
            }

            if (current && isDetailLabel(cleanLine)) {
                appendItemDetail(current, extractDetailText(cleanLine));
                return;
            }

            const markerType = /^\s*\d+[\).]\s+/.test(trimmed) ? 'number' : (isListItem(trimmed) ? 'bullet' : 'plain');
            const startsNewItem = markerType === 'number' || !current || (markerType === 'bullet' && current.markerType !== 'number');

            if (startsNewItem) {
                pushCurrent();
                current = buildValidationItem(trimmed, type, items.length, markerType);
                return;
            }

            appendItemDetail(current, cleanLine);
        });

        pushCurrent();
        return [...tableItems, ...items].filter((item, index, all) => {
            const fingerprint = `${item.category}|${item.description}`.toLowerCase();
            return all.findIndex(other => `${other.category}|${other.description}`.toLowerCase() === fingerprint) === index;
        });
    }

    function parseRecommendations(sectionText) {
        const recommendations = new Map();
        let common = '';

        normalizeReportText(sectionText).split('\n').forEach(line => {
            const cleaned = cleanItemText(line);
            if (!cleaned) return;

            const numbered = stripNumberPrefix(cleaned);
            if (numbered.number) {
                recommendations.set(numbered.number, numbered.text);
            } else {
                common = [common, numbered.text].filter(Boolean).join(' ');
            }
        });

        return { byNumber: recommendations, common };
    }

    function applyRecommendations(violations, recommendationSection) {
        const recommendations = parseRecommendations(recommendationSection);

        violations.forEach(violation => {
            if (violation.recommendation) return;

            const number = (violation.code || '').match(/\d+/)?.[0];
            if (number && recommendations.byNumber.has(number)) {
                violation.recommendation = recommendations.byNumber.get(number);
                return;
            }

            const keywords = violation.category.toLowerCase().split(/\s+/).filter(word => word.length > 4);
            for (const recommendation of recommendations.byNumber.values()) {
                const lower = recommendation.toLowerCase();
                const matches = keywords.filter(keyword => lower.includes(keyword)).length;
                if (matches >= 2) {
                    violation.recommendation = recommendation;
                    return;
                }
            }

            violation.recommendation = recommendations.common || 'См. полный отчёт для рекомендаций';
        });
    }

    function extractValidationReport(text) {
        const normalizedText = normalizeReportText(text);
        const sections = splitReportIntoSections(normalizedText);
        const violationText = sections.violations.join('\n');
        const passedText = sections.passed.join('\n');
        const recommendationsText = sections.recommendations.join('\n');

        const violations = NO_VIOLATIONS_RE.test(violationText)
            ? []
            : parseListItems(violationText || extractStatusLines(normalizedText, 'violation'), 'violation');
        const passed = NO_PASSED_RE.test(passedText)
            ? []
            : parseListItems(passedText || extractStatusLines(normalizedText, 'passed'), 'passed');

        applyRecommendations(violations, recommendationsText);

        const maturity = extractMaturity(normalizedText, sections);
        const summary = extractSummary(normalizedText, sections, violations.length, passed.length);
        const conclusion = extractConclusion(normalizedText, sections);
        const score = extractScore(normalizedText, violations.length, passed.length);

        return { violations, passed, maturity, summary, conclusion, score };
    }

    function extractStatusLines(text, type) {
        const lines = normalizeReportText(text).split('\n');
        return lines.filter(line => {
            if (type === 'violation') return /❌|⚠️|наруш|не\s+соответ|несоответ/i.test(line);
            return /✅|пройден|соответствует|позитив|выполн/i.test(line) && !/не\s+соответ|наруш/i.test(line);
        }).join('\n');
    }

    function extractMaturity(text, sections) {
        const maturityText = [sections.maturity.join('\n'), text].filter(Boolean).join('\n');
        const patterns = [
            /(?:уровень|оценка)\s+зрелости[^0-9]{0,80}([1-5])\s*(?:\/|из)?\s*5?/i,
            /зрелость[^0-9]{0,80}([1-5])\s*(?:\/|из)?\s*5?/i,
            /\b([1-5])\s*\/\s*5\b/
        ];

        for (const pattern of patterns) {
            const match = maturityText.match(pattern);
            if (match) {
                const level = Math.min(5, Math.max(1, parseInt(match[1], 10)));
                const line = maturityText.split('\n').find(item => pattern.test(item)) || '';
                return {
                    level,
                    description: stripMarkdownSyntax(line.replace(match[1], '').replace(/^[^:]+:\s*/, '')) || 'Уровень определён'
                };
            }
        }

        return { level: null, description: 'Не указана в отчёте' };
    }

    function extractSummary(text, sections, violationsCount, passedCount) {
        const summaryText = sections.summary.join('\n').trim();
        if (summaryText) return firstMeaningfulText(summaryText);

        const explicit = text.match(/(?:итог|сводка|результат проверки|вердикт)\s*:\s*([^\n]+)/i);
        if (explicit) return stripMarkdownSyntax(explicit[1]);

        if (violationsCount === 0 && passedCount > 0) return 'Проверка пройдена, нарушений стандартов не найдено';
        if (violationsCount > 0) return `Найдено нарушений: ${violationsCount}. Пройдено проверок: ${passedCount}.`;

        return firstMeaningfulText(text) || 'Проверка завершена';
    }

    function firstMeaningfulText(text) {
        const line = normalizeReportText(text)
            .split('\n')
            .map(stripMarkdownSyntax)
            .find(item => item.length > 12 && !getSectionKey(item));
        return line ? line.slice(0, 240) : '';
    }

    function extractConclusion(text, sections) {
        const conclusionMatch = text.match(/(?:заключение|вывод)\s*:?\s*\n?([^\n]+(?:\n[^\n]+){0,2})/i);
        if (conclusionMatch) return stripMarkdownSyntax(conclusionMatch[1]).slice(0, 360);

        const recommendationText = sections.recommendations.join('\n');
        return firstMeaningfulText(recommendationText).slice(0, 360);
    }

    function extractScore(text, violationsCount, passedCount) {
        const percentMatch = text.match(/(?:оценка|соответствие|готовность|score|итог)[^0-9%]{0,60}(\d{1,3})\s*%/i)
            || text.match(/(\d{1,3})\s*%\s*(?:соответств|готовност|успешн|пройден)/i);

        if (percentMatch) return Math.min(100, Math.max(0, parseInt(percentMatch[1], 10)));

        const total = violationsCount + passedCount;
        if (total > 0) return Math.round((passedCount / total) * 100);
        return violationsCount === 0 ? 100 : 0;
    }

    function looksLikeValidationReport(text) {
        const normalized = normalizeReportText(text).toLowerCase();
        if (!normalized) return false;

        const hasReportSection = [
            'наруш', 'несоответ', 'пройден', 'позитив', 'рекомендац', 'оценка зрелости', 'уровень зрелости'
        ].some(token => normalized.includes(token));

        const hasValidationContext = /стандарт|провер|архитектур|соответств/.test(normalized);
        return hasReportSection && hasValidationContext;
    }

    function resetValidationPanel() {
        lastValidationResults = null;
        if (violationsContent) violationsContent.innerHTML = EMPTY_VALIDATION_HTML;
        if (passedContent) passedContent.innerHTML = EMPTY_VALIDATION_HTML;
        if (summaryContent) summaryContent.innerHTML = EMPTY_VALIDATION_HTML;
        updateValidationTabCounters(0, 0);
        if (showValidationBtn) showValidationBtn.classList.add('hidden');
        if (validationPanel) validationPanel.classList.add('hidden');
    }

    function showValidationLoading() {
        if (!violationsContent || !passedContent || !summaryContent) return;

        violationsContent.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">Анализирую отчёт проверки...</p>';
        passedContent.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">Жду завершения генерации...</p>';
        summaryContent.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">Сводка появится после ответа модели</p>';
        updateValidationTabCounters(0, 0);
        showValidationPanel();
    }

    function updateValidationTabCounters(violationsCount, passedCount) {
        const labels = {
            violations: ['Нарушения', violationsCount],
            passed: ['Пройдено', passedCount],
            summary: ['Сводка', null]
        };

        Object.entries(labels).forEach(([key, [label, count]]) => {
            const tab = document.getElementById(`tab-${key}`);
            if (!tab) return;
            tab.innerHTML = count === null
                ? label
                : `${label} <span class="validation-count">${count}</span>`;
        });
    }

    function parseAndDisplayValidationResults(responseText, options = {}) {
        if (!violationsContent || !passedContent || !summaryContent) return;

        lastValidationResults = responseText;
        const report = extractValidationReport(responseText);

        violationsContent.innerHTML = '';
        passedContent.innerHTML = '';
        summaryContent.innerHTML = '';
        updateValidationTabCounters(report.violations.length, report.passed.length);

        if (report.violations.length === 0) {
            violationsContent.innerHTML = '<p class="text-green-500 text-sm text-center py-4">Нарушений не обнаружено</p>';
        } else {
            report.violations.forEach(v => violationsContent.appendChild(createViolationCard(v)));
        }

        if (report.passed.length === 0) {
            passedContent.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">Пройденные проверки не выделены</p>';
        } else {
            report.passed.forEach(p => passedContent.appendChild(createPassedCard(p)));
        }

        summaryContent.innerHTML = createSummaryHTML(report);

        if (showValidationBtn) showValidationBtn.classList.remove('hidden');
        if (options.openPanel !== false) showValidationPanel();
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

    function createSummaryHTML(report) {
        const { violations, passed, maturity, summary, conclusion, score } = report;
        const scoreClass = score >= 80 ? 'text-green-500' : score >= 50 ? 'text-yellow-500' : 'text-red-500';
        const maturityValue = maturity.level ? `${maturity.level}/5` : '—';

        return `
            <div class="space-y-4">
                <div class="text-center py-4">
                    <div class="text-4xl font-bold ${scoreClass}">${score}%</div>
                    <div class="text-sm text-gray-500 mt-1">${escapeHtml(summary)}</div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="validation-stat bg-green-500/10 text-center">
                        <div class="text-2xl font-bold text-green-500">${passed.length}</div>
                        <div class="text-xs text-gray-500">Пройдено</div>
                    </div>
                    <div class="validation-stat bg-red-500/10 text-center">
                        <div class="text-2xl font-bold text-red-500">${violations.length}</div>
                        <div class="text-xs text-gray-500">Нарушений</div>
                    </div>
                </div>
                <div class="validation-stat bg-primary/10 text-center">
                    <div class="text-sm text-gray-400">Уровень зрелости</div>
                    <div class="text-xl font-bold text-primary">${maturityValue}</div>
                    <div class="text-xs text-gray-500 mt-1">${escapeHtml(maturity.description)}</div>
                </div>
                ${conclusion ? `
                <div class="validation-note bg-surface-container-high/50 border border-outline-variant">
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

        // Если нет активного чата, создаём новый
        if (!currentChatId) {
            // Генерируем название из комментария или файла
            let chatTitle = '';
            const lang = localStorage.getItem('language') || 'ru';

            if (comment) {
                // Берём первые 50 символов из комментария
                chatTitle = comment.slice(0, 50);
                if (chatTitle.length === 50) chatTitle += '...';
            } else if (uploadedFile) {
                // Берём имя файла без расширения
                chatTitle = uploadedFile.name.replace(/\.[^/.]+$/, '');
                if (chatTitle.length > 50) chatTitle = chatTitle.slice(0, 50) + '...';
            } else {
                chatTitle = lang === 'ru' ? 'Новый чат' : 'New chat';
            }

            // Если название пустое, ставим дефолтное
            if (!chatTitle || chatTitle.trim() === '') {
                chatTitle = lang === 'ru' ? 'Новый чат' : 'New chat';
            }

            try {
                const res = await fetch('/api/chats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: chatTitle })
                });
                const chat = await res.json();
                currentChatId = chat.id;
                if (titleEl) titleEl.innerText = chat.title;
                if (chatWindow) chatWindow.innerHTML = '';
                loadChats();
            } catch (e) {
                const message = lang === 'ru' ? '❌ Не удалось создать проект' : '❌ Failed to create project';
                showToast(message);
                console.error(e);
                return;
            }
        }

        // Загрузка файла, если есть
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
                const lang = localStorage.getItem('language') || 'ru';
                const message = lang === 'ru' ? `❌ Ошибка загрузки файла: ${err.message}` : `❌ File upload error: ${err.message}`;
                showToast(message);
                return;
            }
        }

        // Формируем текст сообщения пользователя
        let userDisplayText = comment || 'Проверка решения';
        if (uploadedFile) {
            userDisplayText = `📄 **Файл:** ${uploadedFile.name}` + (comment ? `\n\n**Комментарий:** ${comment}` : '');
        }
        appendMessage('user', userDisplayText);

        if (inputField) {
            inputField.value = '';
            inputField.style.height = 'auto';
        }

        // Сохраняем сообщение в БД
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
        showValidationLoading();

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
            renderAssistantMarkdown(aiContainer, fullText);
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
                const lang = localStorage.getItem('language') || 'ru';
                const errorText = lang === 'ru' ? '⚠️ **Ошибка:** не удалось получить ответ от сервера.' : '⚠️ **Error:** failed to get response from server.';
                renderAssistantMarkdown(aiContainer, errorText);
            }
            clearAttachedFile();
        };
    };

    window.handleAction = async function(endpoint, paramName) {
        const text = inputField?.value.trim();
        if (!text || isLoading) return;

        // Если нет активного чата, создаём новый
        if (!currentChatId) {
            // Генерируем название из первых 50 символов сообщения
            let chatTitle = text.slice(0, 50);
            if (chatTitle.length === 50) chatTitle += '...';
            const lang = localStorage.getItem('language') || 'ru';

            try {
                const res = await fetch('/api/chats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: chatTitle })
                });
                const chat = await res.json();
                currentChatId = chat.id;
                if (titleEl) titleEl.innerText = chat.title;
                if (chatWindow) chatWindow.innerHTML = '';
                loadChats();
            } catch (e) {
                const message = lang === 'ru' ? '❌ Не удалось создать чат' : '❌ Failed to create chat';
                showToast(message);
                console.error(e);
                return;
            }
        }

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
            renderAssistantMarkdown(aiContainer, fullText);
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
                if (looksLikeValidationReport(fullText)) {
                    parseAndDisplayValidationResults(fullText);
                }
            }
        };
    };



    window.createNewChat = async function() {
        const lang = localStorage.getItem('language') || 'ru';
        const defaultTitle = lang === 'ru' ? 'Новый чат' : 'New chat';

        try {
            const res = await fetch('/api/chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: defaultTitle })
            });
            const chat = await res.json();
            selectChat(chat.id, chat.title);

            const message = lang === 'ru' ? '✅ Чат создан' : '✅ Chat created';
            showToast(message, 1500);
        } catch (e) {
            console.error('Ошибка создания чата:', e);
            const message = lang === 'ru' ? '❌ Не удалось создать чат' : '❌ Failed to create chat';
            showToast(message);
        }
    };

    // Enter в модальном окне создания чата
    const newChatInput = document.getElementById('new-chat-title');
    if (newChatInput) {
        newChatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmCreateChat();
            }
        });
    }

    // Закрытие модального окна по клику на фон
    const newChatModal = document.getElementById('new-chat-modal');
    if (newChatModal) {
        newChatModal.addEventListener('click', (e) => {
            if (e.target === newChatModal) {
                closeNewChatModal();
            }
        });
    }

    // Найдите этот блок в script.js (строка с addEventListener для inputField)
    if (inputField) {
        // Авто-расширение textarea
        function autoResizeTextarea() {
            inputField.style.height = 'auto';
            const newHeight = Math.min(inputField.scrollHeight, 200); // максимум 200px
            inputField.style.height = newHeight + 'px';
        }

        inputField.addEventListener('input', autoResizeTextarea);

        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                // Сбрасываем высоту перед отправкой
                inputField.style.height = 'auto';
                handleAction('/api/ai/stream', 'message');
            }
        });

        // Вызов при загрузке страницы
        autoResizeTextarea();
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

        const lang = localStorage.getItem('language') || 'ru';
        const noSourcesText = lang === 'ru' ? 'Нет добавленных источников' : 'No sources added';

        const namesMap = getLocalNamesMap();

        if (sources.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-xs text-center py-2">${noSourcesText}</p>`;
            return;
        }


        container.innerHTML = sources.map(source => {
            const displayName = namesMap[source.id] || source.repositoryUrl.split('/').pop() || 'Источник';
            return `
            <div class="source-item border border-outline-variant/70 rounded-lg overflow-hidden mb-2">
                <div class="flex items-center justify-between p-2 hover:bg-white/5 transition-all">
                    <div class="flex items-center gap-2 overflow-hidden cursor-pointer flex-1" onclick="window.toggleSourceFiles('${source.id}', this)">
                        <span class="source-chevron material-symbols-outlined text-gray-400 text-sm transition-transform">expand_more</span>
                        <span class="material-symbols-outlined text-gray-400 text-base">folder</span>
                        <span class="truncate text-sm" title="${source.repositoryUrl}">${escapeHtml(displayName)}</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <button onclick="event.stopPropagation(); window.syncKnowledgeSource('${source.id}')" class="p-1 hover:bg-primary/20 rounded" title="Синхронизировать">
                            <span class="material-symbols-outlined text-sm">sync</span>
                        </button>
                        <button onclick="event.stopPropagation(); window.deleteKnowledgeSource('${source.id}')" class="p-1 hover:bg-red-500/20 rounded text-red-400" title="Удалить">
                            <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                    </div>
                </div>
                <div id="source-files-${source.id}" class="source-files-container hidden p-2 pt-0 space-y-1 bg-black/10"></div>
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
            const lang = localStorage.getItem('language') || 'ru';
            const message = lang === 'ru' ? 'Введите URL репозитория' : 'Enter repository URL';
            showToast(message);
            return;
        }
        const branch = sourceBranch?.value.trim() || 'main';
        const displayName = sourceDisplayName?.value.trim() || url.split('/').pop() || 'Источник';

        try {
            const res = await fetch('/api/knowledge-sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repositoryUrl: url, branch })
            });
            if (!res.ok) throw new Error('Ошибка создания источника');
            const data = await res.json();

            saveLocalName(data.id, displayName);
            closeSourceModal();
            await loadKnowledgeSources();

            const lang = localStorage.getItem('language') || 'ru';
            const successMessage = lang === 'ru' ? `Источник "${displayName}" добавлен.` : `Source "${displayName}" added.`;
            showToast(successMessage);
        } catch (e) {
            const lang = localStorage.getItem('language') || 'ru';
            const errorMessage = lang === 'ru' ? 'Не удалось добавить источник: ' + e.message : 'Failed to add source: ' + e.message;
            showToast(errorMessage);
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

            const lang = localStorage.getItem('language') || 'ru';
            if (data.status === 'success') {
                const message = lang === 'ru' ? '✅ Синхронизация завершена' : '✅ Sync completed';
                showToast(message);
            } else {
                const message = lang === 'ru' ? '❌ Ошибка синхронизации: ' + data.message : '❌ Sync error: ' + data.message;
                showToast(message);
            }
        } catch (e) {
            const lang = localStorage.getItem('language') || 'ru';
            const message = lang === 'ru' ? '❌ Ошибка синхронизации: ' + e.message : '❌ Sync error: ' + e.message;
            showToast(message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
            await loadKnowledgeSources();
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

            const lang = localStorage.getItem('language') || 'ru';
            if (data.status === 'completed') {
                const message = lang === 'ru' ? data.message : `Sync completed. Success: ${data.successCount || 0}, Errors: ${data.failCount || 0}`;
                showToast(message);
            } else {
                const message = lang === 'ru' ? data.message : 'Sync warning';
                showToast(message);
            }
        } catch (e) {
            const lang = localStorage.getItem('language') || 'ru';
            const message = lang === 'ru' ? '❌ Ошибка синхронизации: ' + e.message : '❌ Sync error: ' + e.message;
            showToast(message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
            await loadKnowledgeSources();
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

    // ========== ПРОСМОТР ФАЙЛОВ ИСТОЧНИКА ==========

    window.toggleSourceFiles = async function(sourceId, btnElement) {
        const container = document.getElementById(`source-files-${sourceId}`);
        const chevron = btnElement.querySelector('.source-chevron');

        if (!container) return;

        if (container.classList.contains('hidden')) {
            container.classList.remove('hidden');
            if (chevron) chevron.style.transform = 'rotate(180deg)';
            await window.loadSourceFiles(sourceId);
        } else {
            container.classList.add('hidden');
            if (chevron) chevron.style.transform = 'rotate(0deg)';
        }
    };

    window.loadSourceFiles = async function(sourceId) {
        const container = document.getElementById(`source-files-${sourceId}`);
        if (!container) return;

        // Убираем bg-black/10, делаем прозрачным
        container.className = 'source-files-container p-2 pt-0 space-y-1';

        container.innerHTML = '<div class="text-center py-2 text-gray-500 text-xs">Загрузка файлов...</div>';

        try {
            const res = await fetch(`/api/knowledge-sources/${sourceId}/files`);
            if (!res.ok) throw new Error('Ошибка загрузки');
            const files = await res.json();

            if (!files || files.length === 0) {
                container.innerHTML = '<div class="text-center py-2 text-gray-500 text-xs">Нет файлов</div>';
                return;
            }

            container.innerHTML = files.map(file => `
                <div class="file-item ml-4 border-l border-outline-variant pl-2 mb-1">
                    <div class="flex items-center justify-between py-1 hover:bg-white/5 rounded px-2">
                        <div class="flex items-center gap-2 flex-1 cursor-pointer" onclick="window.toggleFileContents('${file.id}', this, '${escapeHtml(file.fileName).replace(/'/g, "\\'")}')">
                            <span class="material-symbols-outlined text-gray-500 text-sm">${window.getFileIcon(file.fileName)}</span>
                            <span class="text-xs truncate max-w-[150px]" title="${escapeHtml(file.fileName)}">${escapeHtml(file.fileName)}</span>
                            <span class="file-chevron material-symbols-outlined text-gray-500 text-sm transition-transform">expand_more</span>
                        </div>
                        <button onclick="event.stopPropagation(); window.showFileModal('${file.id}', '${escapeHtml(file.fileName).replace(/'/g, "\\'")}')" class="p-1 hover:bg-primary/20 rounded transition-all" title="Просмотреть в полном окне">
                            <span class="material-symbols-outlined text-sm text-gray-400 hover:text-primary">visibility</span>
                        </button>
                    </div>
                    <div id="file-contents-${file.id}" class="file-contents hidden pl-6 space-y-1 mt-1 mb-2"></div>
                </div>
            `).join('');

            // Применяем стили для светлой темы к контейнеру
            const isDark = document.documentElement.classList.contains('dark');
            if (!isDark) {
                container.style.background = 'transparent';
            }

        } catch (e) {
            console.error(e);
            container.innerHTML = '<div class="text-center py-2 text-red-500 text-xs">Ошибка загрузки</div>';
        }
    };

    window.toggleFileContents = async function(fileId, btnElement, fileName) {
        const container = document.getElementById(`file-contents-${fileId}`);
        const chevron = btnElement.querySelector('.file-chevron');

        if (!container) return;

        if (container.classList.contains('hidden')) {
            container.classList.remove('hidden');
            if (chevron) chevron.style.transform = 'rotate(180deg)';
            await window.loadFileContents(fileId, fileName);
        } else {
            container.classList.add('hidden');
            if (chevron) chevron.style.transform = 'rotate(0deg)';
        }
    };

    window.loadFileContents = async function(fileId, fileName) {
        const container = document.getElementById(`file-contents-${fileId}`);
        if (!container) return;

        container.innerHTML = '<div class="text-center py-2 text-gray-500 text-xs">Загрузка содержимого...</div>';

        try {
            const res = await fetch(`/api/knowledge-sources/files/${fileId}/contents`);
            if (!res.ok) throw new Error('Ошибка загрузки');
            const contents = await res.json();

            if (!contents || contents.length === 0) {
                container.innerHTML = '<div class="text-center py-2 text-gray-500 text-xs">Нет содержимого</div>';
                return;
            }

            // Объединяем все чанки в один текст
            const fullText = contents.map(chunk => chunk.chunkContent).join('\n\n');
            const textLength = fullText.length;

            // Текстовая тема
            const isDark = document.documentElement.classList.contains('dark');
            const bgClass = isDark ? 'bg-black/30' : 'bg-gray-100';
            const textClass = isDark ? 'text-gray-300' : 'text-gray-800';
            const borderClass = isDark ? 'border-outline-variant/50' : 'border-gray-300';

            container.innerHTML = `
                <div class="${bgClass} rounded p-2 text-[12px] ${textClass} border ${borderClass}">
                    <div class="flex justify-between items-center mb-2 pb-2 border-b ${borderClass}">
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary text-sm">description</span>
                            <span class="text-primary text-xs font-mono">${escapeHtml(fileName || 'Файл')}</span>
                        </div>
                        <span class="text-[10px] text-gray-500">${textLength} символов</span>
                    </div>
                    <div class="whitespace-pre-wrap break-words max-h-96 overflow-y-auto" style="font-family: monospace; font-size: 11px; line-height: 1.5;">
                        ${escapeHtml(fullText)}
                    </div>
                </div>
            `;

        } catch (e) {
            console.error(e);
            container.innerHTML = '<div class="text-center py-2 text-red-500 text-xs">Ошибка загрузки</div>';
        }
    };

    window.getFileIcon = function(fileName) {
        if (!fileName) return 'insert_drive_file';
        const ext = fileName.split('.').pop()?.toLowerCase();
        if (ext === 'pdf') return 'picture_as_pdf';
        if (ext === 'docx' || ext === 'doc') return 'description';
        if (ext === 'txt' || ext === 'md') return 'text_snippet';
        if (ext === 'odt') return 'document_scanner';
        return 'insert_drive_file';
    };

    window.showFileModal = async function(fileId, fileName) {
        // Определяем тему
        const isDark = document.documentElement.classList.contains('dark');
        const bgModalClass = isDark ? 'bg-surface-container-high' : 'bg-white';
        const textClass = isDark ? 'text-gray-300' : 'text-gray-800';
        const textContentClass = isDark ? 'text-gray-300' : 'text-gray-800';

        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4';
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };

        const modalContentId = `modal-content-${fileId}`;

        modal.innerHTML = `
            <div class="${bgModalClass} rounded-xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl">
                <div class="flex justify-between items-center p-4 border-b border-outline-variant">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary">description</span>
                        <h3 class="font-bold text-lg ${textClass}">${escapeHtml(fileName)}</h3>
                    </div>
                    <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 transition-all">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="p-4 overflow-y-auto flex-1" id="${modalContentId}">
                    <div class="text-center py-8 text-gray-400">Загрузка содержимого...</div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        try {
            const res = await fetch(`/api/knowledge-sources/files/${fileId}/contents`);
            if (!res.ok) throw new Error('Ошибка загрузки');
            const contents = await res.json();

            if (!contents || contents.length === 0) {
                document.getElementById(modalContentId).innerHTML = '<div class="text-center py-8 text-gray-400">Нет содержимого</div>';
                return;
            }

            const fullText = contents.map(chunk => chunk.chunkContent).join('\n\n');
            const bgContentClass = isDark ? 'bg-black/20' : 'bg-gray-50';

            document.getElementById(modalContentId).innerHTML = `
                <div class="${bgContentClass} rounded p-4 ${textContentClass} font-mono text-sm whitespace-pre-wrap break-words" style="line-height: 1.6; max-height: calc(90vh - 120px); overflow-y: auto;">
                    ${escapeHtml(fullText)}
                </div>
            `;
        } catch (e) {
            document.getElementById(modalContentId).innerHTML = `<div class="text-center py-8 text-red-400">Ошибка загрузки: ${e.message}</div>`;
        }
    };

    // НАСТРОЙКИ
    // ========== НАСТРОЙКИ ==========

    window.openSettingsModal = function() {
        const modal = document.getElementById('settings-modal');
        if (modal) modal.classList.remove('hidden');
        loadSettingsValues();
    };

    window.closeSettingsModal = function() {
        const modal = document.getElementById('settings-modal');
        if (modal) modal.classList.add('hidden');
    };

    window.switchSettingsTab = function(tab) {
        const tabs = ['general', 'performance', 'about'];
        tabs.forEach(t => {
            const content = document.getElementById(`tab-${t}-content`);
            if (content) content.classList.add('hidden');
            const btn = document.getElementById(`tab-${t}`);
            if (btn) {
                btn.classList.remove('bg-primary/10', 'text-primary');
                btn.classList.add('text-gray-600', 'dark:text-gray-400');
            }
        });

        const activeContent = document.getElementById(`tab-${tab}-content`);
        if (activeContent) activeContent.classList.remove('hidden');
        const activeBtn = document.getElementById(`tab-${tab}`);
        if (activeBtn) {
            activeBtn.classList.add('bg-primary/10', 'text-primary');
            activeBtn.classList.remove('text-gray-600', 'dark:text-gray-400');
        }
    };

    function loadSettingsValues() {
        // Тема
        const isDark = document.documentElement.classList.contains('dark');
        const themeToggleBtn = document.getElementById('theme-toggle-settings');
        if (themeToggleBtn) {
            themeToggleBtn.onclick = () => {
                const newDark = !document.documentElement.classList.contains('dark');
                if (newDark) {
                    document.documentElement.classList.add('dark');
                    localStorage.setItem('theme', 'dark');
                } else {
                    document.documentElement.classList.remove('dark');
                    localStorage.setItem('theme', 'light');
                }
                const themeIcon = document.getElementById('theme-icon');
                if (themeIcon) themeIcon.innerText = newDark ? 'light_mode' : 'dark_mode';
            };
        }

        // Загружаем настройки из БД
        try {
            fetch('/api/settings/load')
                .then(res => res.json())
                .then(settings => {
                    console.log('Загружены настройки из БД:', settings);

                    const numThread = settings.num_thread || localStorage.getItem('ollama_num_thread') || '8';
                    const temperature = settings.temperature || localStorage.getItem('ollama_temperature') || '0.35';

                    const slider = document.getElementById('num_thread_slider');
                    const input = document.getElementById('num_thread_value');
                    if (slider) slider.value = numThread;
                    if (input) input.value = numThread;

                    const tempSlider = document.getElementById('temperature_slider');
                    const tempInput = document.getElementById('temperature_value');
                    if (tempSlider) tempSlider.value = temperature;
                    if (tempInput) tempInput.value = temperature;
                })
                .catch(err => {
                    console.warn('Не удалось загрузить настройки из БД, используем localStorage:', err);
                    // fallback на localStorage
                    const savedThreads = localStorage.getItem('ollama_num_thread');
                    if (savedThreads) {
                        const slider = document.getElementById('num_thread_slider');
                        const input = document.getElementById('num_thread_value');
                        if (slider) slider.value = savedThreads;
                        if (input) input.value = savedThreads;
                    }

                    const savedTemp = localStorage.getItem('ollama_temperature');
                    if (savedTemp) {
                        const slider = document.getElementById('temperature_slider');
                        const input = document.getElementById('temperature_value');
                        if (slider) slider.value = savedTemp;
                        if (input) input.value = savedTemp;
                    }
                });
        } catch (e) {
            console.error('Ошибка загрузки настроек:', e);
        }

        // Обработчики слайдеров
        const threadSlider = document.getElementById('num_thread_slider');
        const threadInput = document.getElementById('num_thread_value');
        if (threadSlider && threadInput) {
            threadSlider.oninput = () => { threadInput.value = threadSlider.value; };
            threadInput.onchange = () => { threadSlider.value = threadInput.value; };
        }

        const tempSlider = document.getElementById('temperature_slider');
        const tempInput = document.getElementById('temperature_value');
        if (tempSlider && tempInput) {
            tempSlider.oninput = () => { tempInput.value = tempSlider.value; };
            tempInput.onchange = () => { tempSlider.value = tempInput.value; };
        }
    }

    window.applyPerformanceSettings = async function() {
        const numThread = document.getElementById('num_thread_value').value;
        const temperature = document.getElementById('temperature_value').value;

        localStorage.setItem('ollama_num_thread', numThread);
        localStorage.setItem('ollama_temperature', temperature);

        try {
            const response = await fetch('/api/settings/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    num_thread: parseInt(numThread, 10),
                    temperature: parseFloat(temperature)
                })
            });

            if (response.ok) {
                alert(`Настройки сохранены в БД!\nnum_thread: ${numThread}\ntemperature: ${temperature}`);
            } else {
                const error = await response.text();
                alert(`Ошибка сохранения в БД: ${error}`);
            }
        } catch (error) {
            console.error('Ошибка отправки настроек:', error);
            alert(`Ошибка соединения с сервером: ${error.message}`);
        }
    };

    window.showTerms = function() {
        document.getElementById('terms-modal').classList.remove('hidden');
    };

    window.closeTermsModal = function() {
        document.getElementById('terms-modal').classList.add('hidden');
    };

    window.showPrivacy = function() {
        document.getElementById('privacy-modal').classList.remove('hidden');
    };

    window.closePrivacyModal = function() {
        document.getElementById('privacy-modal').classList.add('hidden');
    };

    window.showLicenses = function() {
        alert("Используемые библиотеки:\n- Spring Boot\n- Ollama\n- Tika\n- PDFBox\n- JGit\n- Tailwind CSS\n- Material Icons");
    };

    // Обработчик кнопки шестерёнки
    const settingsBtn = document.getElementById('settings-gear-btn');
    if (settingsBtn) {
        settingsBtn.onclick = openSettingsModal;
    }

    // Закрытие модальных окон по клику вне
    const modals = ['settings-modal', 'terms-modal', 'privacy-modal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.add('hidden');
            });
        }
    });

    // ========== НАСТРОЙКИ ЯЗЫКА ==========

    // Загрузка сохранённого языка
    function loadLanguage() {
        const savedLang = localStorage.getItem('language') || 'ru';
        const langSelect = document.getElementById('language-select');
        if (langSelect) {
            langSelect.value = savedLang;
        }
        applyLanguage(savedLang);
    }

    // Применение языка к интерфейсу
    function applyLanguage(lang) {
        const translations = {
            ru: {
                'new-chat': 'Новый чат',
                'settings': 'Настройки',
                'general': 'Общие',
                'performance': 'Производительность',
                'about': 'О программе',
                'dark-theme': 'Тёмная тема',
                'dark-theme-desc': 'Включить тёмную тему интерфейса',
                'language': 'Язык интерфейса',
                'language-restart': 'Изменение языка требует перезагрузки страницы',
                'save': 'Сохранить',
                'close': 'Закрыть',
                'send': 'Отправить',
                'check': 'Проверить',
                'attach': 'Прикрепить файл',
                'placeholder': 'Введите описание задачи или прикрепите файл...',
                'threads': 'Потоки CPU (num_thread)',
                'threads-recommend': 'Рекомендуется: 8-10 для 6-ядерного CPU',
                'temperature': 'Температура (креативность)',
                'temperature-desc': '0.3-0.4 — архитектурные задачи, 0.6-0.8 — креативные идеи',
                'save-settings': 'Сохранить настройки',
                'about-title': 'Помощник ИТ-архитектора',
                'about-version': 'Версия 1.0.0',
                'terms': 'Условия использования',
                'privacy': 'Политика конфиденциальности',
                'licenses': 'Лицензии',
                'no-chats': 'Нет чатов',
                'untitled': 'Без названия',
                'select-chat': 'Выберите чат в меню',
                'add-source': 'Добавить источник',
                'sync-all': 'Синхронизировать всё',
                'no-sources': 'Нет добавленных источников',
                'knowledge-base': 'БАЗА ЗНАНИЙ (GITLAB)',
                'footer': 'ЭР-Телеком Холдинг',
                'new-chat-title': 'Создать новый чат',
                'chat-name': 'Название чата',
                'chat-placeholder': 'Например: Проектирование микросервисов',
                'create': 'Создать',
                'source-display-name-placeholder': 'Мои стандарты',
                'source-url-placeholder': 'https://gitlab.com/...',
                'source-branch-placeholder': 'main',
                'source-path-placeholder': '/knowledge',
                'cancel': 'Отмена',
                'add': 'Добавить',
                'source-display-name': 'Название (для отображения)',
                'source-url': 'URL репозитория',
                'source-branch': 'Ветка',
                'source-path': 'Локальный путь (опционально)',
                'add-source-title': 'Добавить источник знаний',
                'ai-disclaimer': 'Сгенерировано ИИ · Информация может быть неточной',
                'logo-title': 'ЭР-Ассистент'
            },
            en: {
                'new-chat': 'New chat',
                'settings': 'Settings',
                'general': 'General',
                'performance': 'Performance',
                'about': 'About',
                'dark-theme': 'Dark theme',
                'dark-theme-desc': 'Enable dark interface theme',
                'language': 'Interface language',
                'language-restart': 'Language change requires page reload',
                'save': 'Save',
                'close': 'Close',
                'send': 'Send',
                'check': 'Check',
                'attach': 'Attach file',
                'placeholder': 'Enter task description or attach a file...',
                'threads': 'CPU threads (num_thread)',
                'threads-recommend': 'Recommended: 8-10 for 6-core CPU',
                'temperature': 'Temperature (creativity)',
                'temperature-desc': '0.3-0.4 — architectural tasks, 0.6-0.8 — creative ideas',
                'save-settings': 'Save settings',
                'about-title': 'IT Architecture Assistant',
                'about-version': 'Version 1.0.0',
                'terms': 'Terms of Use',
                'privacy': 'Privacy Policy',
                'licenses': 'Licenses',
                'no-chats': 'No chats',
                'untitled': 'Untitled',
                'select-chat': 'Select a chat from the menu',
                'add-source': 'Add source',
                'sync-all': 'Sync all',
                'no-sources': 'No sources added',
                'knowledge-base': 'KNOWLEDGE BASE (GITLAB)',
                'footer': 'ER-Telecom Holding',
                'new-chat-title': 'Create new chat',
                'chat-name': 'Chat name',
                'chat-placeholder': 'Example: Microservices design',
                'create': 'Create',
                'source-display-name-placeholder': 'My standards',
                'source-url-placeholder': 'https://gitlab.com/...',
                'source-branch-placeholder': 'main',
                'source-path-placeholder': '/knowledge',
                'cancel': 'Cancel',
                'add': 'Add',
                'source-display-name': 'Name (for display)',
                'source-url': 'Repository URL',
                'source-branch': 'Branch',
                'source-path': 'Local path (optional)',
                'add-source-title': 'Add knowledge source',
                'ai-disclaimer': 'Generated by AI · Information may be inaccurate',
                'logo-title': 'ER-Assistant'
            }
        };

        const t = translations[lang] || translations.ru;


        // Логотип / название в сайдбаре
        const logoTitle = document.getElementById('logo-title');
        if (logoTitle) {
            logoTitle.textContent = t['logo-title'];
        }

        // Подпись "Сгенерировано ИИ"
        const aiDisclaimer = document.getElementById('ai-disclaimer');
        if (aiDisclaimer) {
            aiDisclaimer.textContent = t['ai-disclaimer'];
        }
        // Принудительное обновление текста "Изменение языка требует перезагрузки страницы"
        const allHints = document.querySelectorAll('.text-xs.text-gray-500');
        allHints.forEach(hint => {
            if (hint.textContent.includes('Изменение языка') || hint.textContent.includes('Language change')) {
                hint.textContent = t['language-restart'];
            }
        });

        // Также обновляем конкретный элемент в настройках
        const langHint = document.querySelector('#tab-general-content .text-xs.text-gray-500');
        if (langHint && (langHint.textContent.includes('Изменение') || langHint.textContent.includes('Language'))) {
            langHint.textContent = t['language-restart'];
        }

        // Кнопка "Новый чат"
        const newChatBtn = document.querySelector('.btn-new-chat');
        if (newChatBtn) {
            newChatBtn.innerHTML = `<span class="material-symbols-outlined">add</span> ${t['new-chat']}`;
        }

        // Сообщение "Нет добавленных источников" (принудительно)
        const sourcesList = document.getElementById('knowledge-sources-list');
        if (sourcesList && sourcesList.innerHTML.includes('Нет добавленных источников')) {
            sourcesList.innerHTML = `<p class="text-gray-500 text-xs text-center py-2">${t['no-sources']}</p>`;
        } else if (sourcesList && sourcesList.children.length === 0) {
            sourcesList.innerHTML = `<p class="text-gray-500 text-xs text-center py-2">${t['no-sources']}</p>`;
        }

        // Заголовок настроек
        const settingsTitle = document.querySelector('#settings-modal h2');
        if (settingsTitle) settingsTitle.textContent = t['settings'];

        // Вкладки
        const generalTab = document.getElementById('tab-general');
        if (generalTab) generalTab.innerHTML = `<span class="material-symbols-outlined text-sm align-middle mr-2">settings</span> ${t['general']}`;

        const performanceTab = document.getElementById('tab-performance');
        if (performanceTab) performanceTab.innerHTML = `<span class="material-symbols-outlined text-sm align-middle mr-2">speed</span> ${t['performance']}`;

        const aboutTab = document.getElementById('tab-about');
        if (aboutTab) aboutTab.innerHTML = `<span class="material-symbols-outlined text-sm align-middle mr-2">info</span> ${t['about']}`;

        // Тёмная тема
        const themeLabel = document.querySelector('#tab-general-content .text-sm.font-medium');
        if (themeLabel) themeLabel.textContent = t['dark-theme'];

        const themeDesc = document.querySelector('#tab-general-content .text-xs.text-gray-500');
        if (themeDesc && themeDesc.parentElement === themeLabel?.parentElement) {
            themeDesc.textContent = t['dark-theme-desc'];
        }

        // Язык
        const langLabel = document.querySelector('#tab-general-content select')?.previousElementSibling;
        if (langLabel) langLabel.textContent = t['language'];



        // Производительность
        const threadsLabel = document.querySelector('#tab-performance-content .text-sm.font-medium');
        if (threadsLabel) threadsLabel.textContent = t['threads'];

        const threadsHint = document.querySelector('#tab-performance-content .text-xs.text-gray-500');
        if (threadsHint && threadsHint.textContent.includes('Рекомендуется')) {
            threadsHint.textContent = t['threads-recommend'];
        }

        const tempLabel = document.querySelectorAll('#tab-performance-content .text-sm.font-medium')[1];
        if (tempLabel) tempLabel.textContent = t['temperature'];

        const tempHint = document.querySelectorAll('#tab-performance-content .text-xs.text-gray-500')[1];
        if (tempHint && tempHint.textContent.includes('0.3-0.4')) {
            tempHint.textContent = t['temperature-desc'];
        }

        const saveBtn = document.querySelector('#tab-performance-content button');
        if (saveBtn) saveBtn.textContent = t['save-settings'];

        // Кнопка закрытия
        const closeBtn = document.querySelector('#settings-modal .border-t button');
        if (closeBtn) closeBtn.textContent = t['close'];

        // О программе
        const aboutTitle = document.querySelector('#tab-about-content h3');
        if (aboutTitle) aboutTitle.textContent = t['about-title'];

        const aboutVersion = document.querySelector('#tab-about-content .text-xs.text-gray-400');
        if (aboutVersion) aboutVersion.textContent = t['about-version'];

        const termsBtn = document.querySelector('#tab-about-content button:first-of-type');
        if (termsBtn) termsBtn.innerHTML = `📜 ${t['terms']}`;

        const privacyBtn = document.querySelectorAll('#tab-about-content button')[1];
        if (privacyBtn) privacyBtn.innerHTML = `🔒 ${t['privacy']}`;

        const licensesBtn = document.querySelectorAll('#tab-about-content button')[2];
        if (licensesBtn) licensesBtn.innerHTML = `📄 ${t['licenses']}`;

        // Кнопки чата
        const sendBtn = document.querySelector('button[onclick*="handleAction"]');
        if (sendBtn) sendBtn.title = t['send'];

        const validateBtn = document.querySelector('button[onclick="validateSolution()"]');
        if (validateBtn) validateBtn.innerHTML = `<span class="material-symbols-outlined text-lg">verified</span> ${t['check']}`;

        const attachLabel = document.getElementById('attach-btn');
        if (attachLabel) attachLabel.title = t['attach'];

        // Поле ввода
        const inputField = document.getElementById('user-input');
        if (inputField && !inputField.placeholder.includes('Файл')) {
            inputField.placeholder = t['placeholder'];
        }

        // Текст в модалках
        const termsTitle = document.querySelector('#terms-modal h2');
        if (termsTitle) termsTitle.textContent = t['terms'];

        const privacyTitle = document.querySelector('#privacy-modal h2');
        if (privacyTitle) privacyTitle.textContent = t['privacy'];

        const termsOkBtn = document.querySelector('#terms-modal .bg-primary');
        if (termsOkBtn) termsOkBtn.textContent = t['close'];

        const privacyOkBtn = document.querySelector('#privacy-modal .bg-primary');
        if (privacyOkBtn) privacyOkBtn.textContent = t['close'];

        // Заголовок "Выберите чат в меню"
        const activeChatTitle = document.getElementById('active-chat-title');
        if (activeChatTitle && !activeChatTitle.innerText.includes('Файл')) {
            activeChatTitle.textContent = t['select-chat'];
        }

        // Кнопка "Добавить источник"
        const addSourceBtn = document.querySelector('#knowledge-section button:first-child');
        if (addSourceBtn) {
            addSourceBtn.innerHTML = `<span class="material-symbols-outlined text-base">cloud_upload</span> ${t['add-source']}`;
        }

        // Кнопка "Синхронизировать всё"
        const syncAllBtn = document.querySelector('#knowledge-section button:last-child');
        if (syncAllBtn && syncAllBtn.querySelector('.material-symbols-outlined')?.textContent === 'sync') {
            syncAllBtn.innerHTML = `<span class="material-symbols-outlined text-base">sync</span> ${t['sync-all']}`;
        }

        const knowledgeTexts = document.querySelectorAll('.text-gray-500.uppercase');
        knowledgeTexts.forEach(el => {
            if (el.textContent.includes('БАЗА ЗНАНИЙ') || el.textContent.includes('KNOWLEDGE BASE')) {
                el.textContent = t['knowledge-base'];
            }
        });

        // Кнопка "Синхронизировать всё" (переопределяем forcefully)
        const syncBtn = document.querySelector('#knowledge-section button.bg-primary\\/20');
        if (syncBtn) {
            syncBtn.innerHTML = `<span class="material-symbols-outlined text-base">sync</span> ${t['sync-all']}`;
        } else {
            // Альтернативный поиск
            const allBtns = document.querySelectorAll('#knowledge-section button');
            allBtns.forEach(btn => {
                if (btn.textContent.includes('Синхронизировать') || btn.innerHTML.includes('sync')) {
                    btn.innerHTML = `<span class="material-symbols-outlined text-base">sync</span> ${t['sync-all']}`;
                }
            });
        }

        // Кнопка "Добавить источник"
        const addBtn = document.querySelector('#knowledge-section button:first-child');
        if (addBtn) {
            addBtn.innerHTML = `<span class="material-symbols-outlined text-base">cloud_upload</span> ${t['add-source']}`;
        }

        // Сообщение "Нет добавленных источников"
        const sourcesContainer = document.getElementById('knowledge-sources-list');
        if (sourcesContainer && sourcesContainer.innerHTML.includes('Нет добавленных источников')) {
            sourcesContainer.innerHTML = `<p class="text-gray-500 text-xs text-center py-2">${t['no-sources']}</p>`;
        } else if (sourcesContainer && sourcesContainer.children.length === 0) {
            sourcesContainer.innerHTML = `<p class="text-gray-500 text-xs text-center py-2">${t['no-sources']}</p>`;
        }

        // Заголовок "БАЗА ЗНАНИЙ"
        const knowledgeHeader = document.querySelector('.border-t .text-gray-500.uppercase');
        if (knowledgeHeader) {
            knowledgeHeader.textContent = t['knowledge-base'];
        }

        // Футер
        const footer = document.querySelector('.footer-brand p');
        if (footer) {
            footer.textContent = t['footer'];
        }

        // Модальное окно создания чата
        const modalTitle = document.querySelector('#new-chat-modal h2');
        if (modalTitle) modalTitle.textContent = t['new-chat-title'];

        const modalLabel = document.querySelector('#new-chat-modal label');
        if (modalLabel) modalLabel.textContent = t['chat-name'];

        const modalInput = document.getElementById('new-chat-title');
        if (modalInput) modalInput.placeholder = t['chat-placeholder'];

        const cancelBtn = document.querySelector('#new-chat-modal button:first-of-type');
        if (cancelBtn) cancelBtn.textContent = t['cancel'];

        const createBtn = document.querySelector('#new-chat-modal button:last-of-type');
        if (createBtn) createBtn.textContent = t['create'];

        // Модальное окно добавления источника
        const sourceModalTitle = document.getElementById('source-modal-title');
        if (sourceModalTitle) sourceModalTitle.textContent = t['add-source-title'];

        const displayNameLabel = document.getElementById('source-display-name-label');
        if (displayNameLabel) displayNameLabel.textContent = t['source-display-name'];

        const displayNameInput = document.getElementById('source-display-name-input');
        if (displayNameInput) displayNameInput.placeholder = t['source-display-name-placeholder'];

        const urlLabel = document.getElementById('source-url-label');
        if (urlLabel) urlLabel.textContent = t['source-url'];

        const urlInput = document.getElementById('source-url-input');
        if (urlInput) urlInput.placeholder = t['source-url-placeholder'];

        const branchLabel = document.getElementById('source-branch-label');
        if (branchLabel) branchLabel.textContent = t['source-branch'];

        const branchInput = document.getElementById('source-branch-input');
        if (branchInput) branchInput.placeholder = t['source-branch-placeholder'];

        const pathLabel = document.getElementById('source-path-label');
        if (pathLabel) pathLabel.textContent = t['source-path'];

        const pathInput = document.getElementById('source-path-input');
        if (pathInput) pathInput.placeholder = t['source-path-placeholder'];

        const sourceCancelBtn = document.getElementById('source-modal-cancel');
        if (sourceCancelBtn) sourceCancelBtn.textContent = t['cancel'];

        const sourceAddBtn = document.getElementById('source-modal-add');
        if (sourceAddBtn) sourceAddBtn.textContent = t['add'];
    }

    function saveLanguage() {
        const langSelect = document.getElementById('language-select');
        if (langSelect) {
            const lang = langSelect.value;
            localStorage.setItem('language', lang);
            applyLanguage(lang);
            const message = lang === 'ru' ? 'Язык изменён. Перезагрузите страницу.' : 'Language changed. Please reload the page.';
            showToast(message);
        }
    }

    // Инициализация языка
    function initLanguage() {
        const langSelect = document.getElementById('language-select');
        if (langSelect) {
            langSelect.onchange = () => {
                saveLanguage();
            };
        }
        loadLanguage();
    }

    initLanguage();

    function showToast(message, duration = 3000) {
        const toast = document.getElementById('custom-toast');
        const toastMessage = document.getElementById('toast-message');

        if (!toast) return;

        toastMessage.textContent = message;
        toast.classList.remove('opacity-0', 'translate-y-10');
        toast.classList.add('opacity-100', 'translate-y-0');

        setTimeout(() => {
            toast.classList.remove('opacity-100', 'translate-y-0');
            toast.classList.add('opacity-0', 'translate-y-10');
        }, duration);
    }

    // Кастомный селект языка
    function initCustomLanguageSelect() {
        const selectBtn = document.getElementById('language-select-btn');
        const dropdown = document.getElementById('language-dropdown');
        const selectedText = document.getElementById('language-selected-text');
        const arrow = document.getElementById('language-arrow');
        const options = document.querySelectorAll('.language-option');

        if (!selectBtn) return;

        // Открытие/закрытие дропдауна
        selectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
            arrow.style.transform = dropdown.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
        });

        // Выбор опции
        options.forEach(option => {
            option.addEventListener('click', () => {
                const lang = option.dataset.lang;
                const langName = option.querySelector('span:last-child').textContent;
                const checkIcon = option.querySelector('.material-symbols-outlined');

                // Обновляем выбранный текст
                selectedText.innerHTML = `<span class="material-symbols-outlined text-base">language</span> ${langName}`;

                // Обновляем галочки
                options.forEach(opt => {
                    const icon = opt.querySelector('.material-symbols-outlined');
                    if (icon) icon.classList.add('opacity-0');
                });
                if (checkIcon) checkIcon.classList.remove('opacity-0');

                // Закрываем дропдаун
                dropdown.classList.add('hidden');
                arrow.style.transform = 'rotate(0deg)';

                // Сохраняем язык
                localStorage.setItem('language', lang);
                applyLanguage(lang);

                // Показываем уведомление о перезагрузке
                const message = lang === 'ru' ? 'Язык изменён. Перезагрузите страницу.' : 'Language changed. Please reload the page.';
                showToast(message);
            });
        });

        // Закрытие при клике вне
        document.addEventListener('click', (e) => {
            if (!selectBtn.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
                arrow.style.transform = 'rotate(0deg)';
            }
        });

        // Установка выбранного значения при загрузке
        const savedLang = localStorage.getItem('language') || 'ru';
        const activeOption = document.querySelector(`.language-option[data-lang="${savedLang}"]`);
        if (activeOption) {
            const langName = activeOption.querySelector('span:last-child').textContent;
            selectedText.innerHTML = `<span class="material-symbols-outlined text-base">language</span> ${langName}`;

            // Обновляем галочки
            options.forEach(opt => {
                const icon = opt.querySelector('.material-symbols-outlined');
                if (icon) icon.classList.add('opacity-0');
            });
            const checkIcon = activeOption.querySelector('.material-symbols-outlined');
            if (checkIcon) checkIcon.classList.remove('opacity-0');
        }
    }

    // Инициализация кастомного селекта языка
    initCustomLanguageSelect();


    // ========== КОНТЕКСТНОЕ МЕНЮ ДЛЯ ЧАТОВ ==========

// Функция переименования чата
    window.renameChat = async function(chatId, currentTitle) {
        const lang = localStorage.getItem('language') || 'ru';
        const newTitle = prompt(
            lang === 'ru' ? 'Введите новое название чата:' : 'Enter new chat name:',
            currentTitle
        );

        if (!newTitle || newTitle.trim() === '') return;

        try {
            const res = await fetch(`/api/chats/${chatId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle.trim() })
            });

            if (!res.ok) throw new Error('Ошибка переименования');

            // Обновляем отображение
            await loadChats();

            // Если это текущий активный чат, обновляем заголовок
            if (currentChatId === chatId && titleEl) {
                titleEl.innerText = newTitle.trim();
            }

            const message = lang === 'ru' ? '✅ Чат переименован' : '✅ Chat renamed';
            showToast(message, 1500);
        } catch (e) {
            console.error('Ошибка переименования:', e);
            const message = lang === 'ru' ? '❌ Не удалось переименовать чат' : '❌ Failed to rename chat';
            showToast(message);
        }
    };

// Функция удаления чата
    // Переменные для хранения ID чата при удалении
    let deletingChatId = null;
    let deletingChatTitle = null;

// Открыть модалку подтверждения удаления
    window.openDeleteModal = function(chatId, chatTitle) {
        deletingChatId = chatId;
        deletingChatTitle = chatTitle;

        const modal = document.getElementById('delete-chat-modal');
        const chatNameSpan = document.getElementById('delete-chat-name');

        if (modal && chatNameSpan) {
            chatNameSpan.textContent = chatTitle;
            modal.classList.remove('hidden');
        }
    };

// Закрыть модалку удаления
    window.closeDeleteModal = function() {
        const modal = document.getElementById('delete-chat-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        deletingChatId = null;
        deletingChatTitle = null;
    };

// Подтвердить удаление
    window.confirmDeleteChat = async function() {
        if (!deletingChatId) return;

        const lang = localStorage.getItem('language') || 'ru';

        try {
            const res = await fetch(`/api/chats/${deletingChatId}`, {
                method: 'DELETE'
            });

            if (!res.ok) throw new Error('Ошибка удаления');

            // Если удалили текущий чат, сбрасываем
            if (currentChatId === deletingChatId) {
                currentChatId = null;
                if (titleEl) titleEl.innerText = lang === 'ru' ? 'Выберите чат в меню' : 'Select a chat from menu';
                if (chatWindow) chatWindow.innerHTML = '';
                resetValidationPanel();
            }

            closeDeleteModal();
            await loadChats();

            const message = lang === 'ru' ? '✅ Чат удалён' : '✅ Chat deleted';
            showToast(message, 1500);
        } catch (e) {
            console.error('Ошибка удаления:', e);
            const message = lang === 'ru' ? '❌ Не удалось удалить чат' : '❌ Failed to delete chat';
            showToast(message);
            closeDeleteModal();
        }
    };

// Функция закрепления/открепления чата
    window.pinChat = async function(chatId, event) {
        event.stopPropagation();
        const lang = localStorage.getItem('language') || 'ru';

        try {
            const res = await fetch(`/api/chats/${chatId}/pin`, {
                method: 'PUT'
            });

            if (!res.ok) throw new Error('Ошибка закрепления');

            const data = await res.json();
            await loadChats(); // Перезагружаем список (закреплённые будут сверху)

            const message = data.pinned
                ? (lang === 'ru' ? '📌 Чат закреплён' : '📌 Chat pinned')
                : (lang === 'ru' ? '📍 Чат откреплён' : '📍 Chat unpinned');
            showToast(message, 1500);
        } catch (e) {
            console.error('Ошибка закрепления:', e);
            const message = lang === 'ru' ? '❌ Не удалось закрепить чат' : '❌ Failed to pin chat';
            showToast(message);
        }
    };

    window.showChatMenu = function(event, chatId, chatTitle) {
        event.stopPropagation();

        const lang = localStorage.getItem('language') || 'ru';

        // Удаляем старое меню, если есть
        const existingMenu = document.querySelector('.chat-context-menu');
        if (existingMenu) existingMenu.remove();

        // Создаём новое меню
        const menu = document.createElement('div');
        menu.className = 'chat-context-menu fixed bg-white dark:bg-surface-container-high rounded-lg shadow-xl border border-gray-200 dark:border-outline-variant z-50 min-w-[180px] overflow-hidden';

        // Позиционируем меню рядом с кнопкой
        const btn = event.target.closest('.chat-menu-btn');
        if (btn) {
            const rect = btn.getBoundingClientRect();
            let left = rect.left - 180;
            let top = rect.top;

            // Проверяем, чтобы меню не выходило за левый край
            if (left < 10) left = rect.left + 30;
            // Проверяем, чтобы не выходило за нижний край
            if (top + 200 > window.innerHeight) top = rect.top - 150;

            menu.style.left = `${left}px`;
            menu.style.top = `${top}px`;
        }

        menu.innerHTML = `
        <div class="py-1">
            <button onclick="window.openRenameModal('${chatId}', '${chatTitle.replace(/'/g, "\\'")}'); document.querySelector('.chat-context-menu')?.remove();" 
                    class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all flex items-center gap-2">
                <span class="material-symbols-outlined text-base">edit</span>
                ${lang === 'ru' ? 'Переименовать' : 'Rename'}
            </button>
            <button onclick="window.pinChat('${chatId}', event); document.querySelector('.chat-context-menu')?.remove();" 
                    class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all flex items-center gap-2">
                <span class="material-symbols-outlined text-base">push_pin</span>
                ${lang === 'ru' ? 'Закрепить / Открепить' : 'Pin / Unpin'}
            </button>
            <div class="border-t border-gray-200 dark:border-outline-variant my-1"></div>
            <button onclick="window.openDeleteModal('${chatId}', '${chatTitle.replace(/'/g, "\\'")}'); document.querySelector('.chat-context-menu')?.remove();" 
                    class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all flex items-center gap-2">
                <span class="material-symbols-outlined text-base">delete</span>
                ${lang === 'ru' ? 'Удалить' : 'Delete'}
            </button>
        </div>
    `;

        document.body.appendChild(menu);

        // Закрываем меню при клике вне
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    };

    // Переменные для хранения ID чата при переименовании
    let renamingChatId = null;
    let renamingOldTitle = null;

// Открыть модалку переименования
    window.openRenameModal = function(chatId, currentTitle) {
        renamingChatId = chatId;
        renamingOldTitle = currentTitle;

        const modal = document.getElementById('rename-chat-modal');
        const input = document.getElementById('rename-chat-title');

        if (modal && input) {
            input.value = currentTitle;
            modal.classList.remove('hidden');
            input.focus();
            input.select();
        }
    };

// Закрыть модалку переименования
    window.closeRenameModal = function() {
        const modal = document.getElementById('rename-chat-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        renamingChatId = null;
        renamingOldTitle = null;
    };

// Подтвердить переименование
    window.confirmRenameChat = async function() {
        const input = document.getElementById('rename-chat-title');
        const newTitle = input?.value.trim();

        if (!newTitle) {
            const lang = localStorage.getItem('language') || 'ru';
            const message = lang === 'ru' ? 'Введите название чата' : 'Enter chat name';
            showToast(message);
            return;
        }

        if (!renamingChatId) return;

        const lang = localStorage.getItem('language') || 'ru';

        try {
            const res = await fetch(`/api/chats/${renamingChatId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle })
            });

            if (!res.ok) throw new Error('Ошибка переименования');

            closeRenameModal();
            await loadChats();

            // Если это текущий активный чат, обновляем заголовок
            if (currentChatId === renamingChatId && titleEl) {
                titleEl.innerText = newTitle;
            }

            const message = lang === 'ru' ? '✅ Чат переименован' : '✅ Chat renamed';
            showToast(message, 1500);
        } catch (e) {
            console.error('Ошибка переименования:', e);
            const message = lang === 'ru' ? '❌ Не удалось переименовать чат' : '❌ Failed to rename chat';
            showToast(message);
        }
    };

// Enter в модалке переименования
    const renameInput = document.getElementById('rename-chat-title');
    if (renameInput) {
        renameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmRenameChat();
            }
        });
    }

// Закрытие модалки по клику на фон
    const renameModal = document.getElementById('rename-chat-modal');
    if (renameModal) {
        renameModal.addEventListener('click', (e) => {
            if (e.target === renameModal) {
                closeRenameModal();
            }
        });
    }
})();
