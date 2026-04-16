(function () {
    "use strict";

    let currentChatId = null;
    let currentEventSource = null;
    let isLoading = false;

    const chatWindow = document.getElementById('chat-window');
    const loader = document.getElementById('loader');
    const stopBtn = document.getElementById('stop-stream-btn');
    const titleEl = document.getElementById('active-chat-title');
    const inputField = document.getElementById('user-input');
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

    marked.setOptions({ breaks: true, gfm: true });

    // ---------- ТЕМА ----------
    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        if (savedTheme === 'light') {
            document.documentElement.classList.remove('dark');
            themeIcon.innerText = 'dark_mode';
        } else {
            document.documentElement.classList.add('dark');
            themeIcon.innerText = 'light_mode';
        }
    }

    themeToggle.onclick = () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        themeIcon.innerText = isDark ? 'light_mode' : 'dark_mode';
    };

    // ---------- ЛОГИКА ЧАТОВ ----------
    async function loadChats() {
        try {
            const res = await fetch('/api/chats');
            if (!res.ok) throw new Error('Ошибка сети');

            const chats = await res.json();
            const list = document.getElementById('chat-list'); // Должно совпадать с ID в HTML

            if (!list) {
                console.error("Элемент 'chat-list' не найден на странице!");
                return;
            }

            list.innerHTML = ''; // Очищаем старый список

            chats.forEach(chat => {
                const div = document.createElement('div');
                // Проверьте: в Java это 'id', значит тут 'chat.id'
                const isActive = currentChatId === chat.id;

                div.className = `p-3 rounded-xl cursor-pointer transition-all flex items-center gap-3 text-sm ${
                    isActive
                        ? 'bg-[#0054a6] text-white shadow-md'
                        : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/5'
                }`;

                // Иконка и название
                div.innerHTML = `
                <span class="material-symbols-outlined text-[18px]">chat</span> 
                <span class="truncate">${chat.title || 'Без названия'}</span>
            `;

                div.onclick = () => selectChat(chat.id, chat.title);
                list.appendChild(div);
            });

            console.log("Загружено чатов:", chats.length);
        } catch (e) {
            console.error('Ошибка при отрисовке списка:', e);
        }
    }

    window.createNewChat = async function() {
        const title = prompt("Название нового проекта:");
        if (!title) return;

        try {
            const res = await fetch('/api/chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: title })
            });

            if (!res.ok) throw new Error('Ошибка при создании');

            const newChat = await res.json();

            // ВАЖНО: сначала обновляем список, потом выбираем новый чат
            await loadChats();
            selectChat(newChat.id, newChat.title);

        } catch (e) {
            alert('Не удалось создать проект');
            console.error(e);
        }
    }

    async function selectChat(id, title) {
        currentChatId = id;
        titleEl.innerText = title;
        chatWindow.innerHTML = '';
        try {
            const res = await fetch(`/api/messages/chat/${id}`);
            const messages = await res.json();
            messages.forEach(msg => appendMessage(msg.role, msg.content));
        } catch (e) { console.error('Ошибка сообщений'); }
        loadChats();
    }

    function appendMessage(role, content) {
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
        loader.classList.toggle('hidden', !state);
        stopBtn.classList.toggle('hidden', !state);
        inputField.disabled = state;
    }

    window.stopStreaming = function() {
        if (currentEventSource) { currentEventSource.close(); currentEventSource = null; }
        setLoading(false);
    }

    window.handleAction = async function(endpoint, paramName) {
        const text = inputField.value.trim();
        if (!text || !currentChatId || isLoading) return;

        inputField.value = '';
        inputField.style.height = '';
        appendMessage('user', text);

        try {
            await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: currentChatId, role: 'user', content: text })
            });
        } catch (e) { console.warn('Ошибка сохранения'); }

        const aiContainer = appendMessage('assistant', '');
        let fullText = '';
        setLoading(true);

        const url = `${endpoint}?${paramName}=${encodeURIComponent(text)}`;
        currentEventSource = new EventSource(url);

        currentEventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const chunk = data.content || "";
                fullText += chunk;
                aiContainer.innerHTML = marked.parse(fullText);
            } catch (e) {
                fullText += event.data;
                aiContainer.innerHTML = marked.parse(fullText);
            }
            chatWindow.scrollTop = chatWindow.scrollHeight;
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
    }

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
    }

    inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAction('/api/ai/stream', 'message');
        }
    });

    initTheme();
    loadChats();
})();