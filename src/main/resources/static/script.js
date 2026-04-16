(function () {
    "use strict";

    let currentChatId = null;
    let currentEventSource = null;
    let isLoading = false;

    // DOM элементы (с проверкой существования)
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

    let uploadedFile = null;
    let uploadedDocumentId = null;

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
        section.classList.toggle('hidden');
        chevron.style.transform = section.classList.contains('hidden') ? 'rotate(180deg)' : 'rotate(0deg)';
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

        wrapper.innerHTML = `
            <div class="max-w-[85%]">
                ${isAI ? '<div class="text-primary font-bold text-[10px] mb-1 uppercase tracking-widest">ArchAssistant</div>' : ''}
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

    // ---------- УПРАВЛЕНИЕ БАЗОЙ ЗНАНИЙ ----------
    const sourceModal = document.getElementById('source-modal');
    const sourceUrl = document.getElementById('source-url');
    const sourceBranch = document.getElementById('source-branch');
    const sourcePath = document.getElementById('source-path');

    window.openAddSourceModal = function() {
        if (sourceModal) {
            sourceModal.classList.remove('hidden');
            if (sourceUrl) sourceUrl.value = '';
            if (sourceBranch) sourceBranch.value = 'main';
            if (sourcePath) sourcePath.value = '';
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

        try {
            const res = await fetch('/api/knowledge-sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repositoryUrl: url, branch, localPath })
            });
            if (!res.ok) throw new Error('Ошибка создания источника');
            const data = await res.json();
            alert(`Источник "${data.repositoryUrl}" добавлен (ID: ${data.id})`);
            closeSourceModal();
        } catch (e) {
            alert('Не удалось добавить источник: ' + e.message);
            console.error(e);
        }
    };

    window.syncAllKnowledgeSources = async function() {
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

    if (sourceModal) {
        sourceModal.addEventListener('click', (e) => {
            if (e.target === sourceModal) closeSourceModal();
        });
    }

    initTheme();
    loadChats();
})();