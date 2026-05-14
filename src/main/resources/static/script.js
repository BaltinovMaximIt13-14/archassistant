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
                    isActive ? 'bg-[#0054a6] text-white shadow-md' : 'text-gray-500 dark:text-white hover:bg-black/5 dark:hover:bg-white/5'
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
                renderAssistantMarkdown(aiContainer, '⚠️ **Ошибка:** не удалось получить ответ от сервера.');
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

    window.openNewChatModal = function() {
        const modal = document.getElementById('new-chat-modal');
        if (modal) {
            modal.classList.remove('hidden');
            const input = document.getElementById('new-chat-title');
            if (input) {
                input.value = '';
                input.focus();
            }
        }
    };

    window.closeNewChatModal = function() {
        const modal = document.getElementById('new-chat-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    };

    window.confirmCreateChat = async function() {
        const input = document.getElementById('new-chat-title');
        const title = input?.value.trim();

        if (!title) {
            alert('Введите название чата');
            return;
        }

        closeNewChatModal();

        try {
            const res = await fetch('/api/chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title })
            });
            const chat = await res.json();
            selectChat(chat.id, chat.title);
        } catch (e) {
            console.error('Ошибка создания чата:', e);
            alert('Не удалось создать чат');
        }
    };

    // Старая функция createNewChat заменена на openNewChatModal
    window.createNewChat = window.openNewChatModal;

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


})();
