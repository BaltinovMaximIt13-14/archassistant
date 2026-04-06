// API клиент для взаимодействия с бэкендом
const API_BASE = '/api';

const api = {
    // ============ CHATS ============
    async createChat(title) {
        const response = await fetch(`${API_BASE}/chats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });
        if (!response.ok) throw new Error('Failed to create chat');
        return response.json();
    },

    async getAllChats() {
        const response = await fetch(`${API_BASE}/chats`);
        if (!response.ok) throw new Error('Failed to fetch chats');
        return response.json();
    },

    async getChat(id) {
        const response = await fetch(`${API_BASE}/chats/${id}`);
        if (!response.ok) throw new Error('Failed to fetch chat');
        return response.json();
    },

    async getMessages(chatId) {
        const response = await fetch(`${API_BASE}/chats/${chatId}/messages`);
        if (!response.ok) throw new Error('Failed to fetch messages');
        return response.json();
    },

    async updateChatTitle(id, title) {
        const response = await fetch(`${API_BASE}/chats/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });
        if (!response.ok) throw new Error('Failed to update chat');
        return response.json();
    },

    async deleteChat(id) {
        const response = await fetch(`${API_BASE}/chats/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete chat');
        return response.json();
    },

    // ============ MESSAGES ============
    async createMessage(chatId, role, content) {
        const response = await fetch(`${API_BASE}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, role, content })
        });
        if (!response.ok) throw new Error('Failed to create message');
        return response.json();
    },

    // ============ AI ============
    // Простой запрос к AI
    async askAI(message) {
        const response = await fetch(`${API_BASE}/ai/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        if (!response.ok) throw new Error('Failed to get AI response');
        return response.json();
    },

    // ============ DOCUMENTS ============
    async uploadDocument(chatId, formData) {
        const response = await fetch(`${API_BASE}/documents/upload/${chatId}`, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) throw new Error('Failed to upload document');
        return response.json();
    },

    async getDocumentsByChat(chatId) {
        const response = await fetch(`${API_BASE}/documents/chat/${chatId}`);
        if (!response.ok) throw new Error('Failed to fetch documents');
        return response.json();
    },

    async deleteDocument(documentId) {
        const response = await fetch(`${API_BASE}/documents/${documentId}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete document');
        return response.json();
    },

    async getDocumentChunks(documentId) {
        const response = await fetch(`${API_BASE}/documents/${documentId}/chunks`);
        if (!response.ok) throw new Error('Failed to fetch document chunks');
        return response.json();
    },

    // ============ KNOWLEDGE SOURCES ============
    async createKnowledgeSource(repositoryUrl, branch, localPath) {
        const response = await fetch(`${API_BASE}/knowledge-sources`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repositoryUrl, branch, localPath })
        });
        if (!response.ok) throw new Error('Failed to create knowledge source');
        return response.json();
    },

    async getAllKnowledgeSources() {
        const response = await fetch(`${API_BASE}/knowledge-sources`);
        if (!response.ok) throw new Error('Failed to fetch knowledge sources');
        return response.json();
    },

    async deleteKnowledgeSource(id) {
        const response = await fetch(`${API_BASE}/knowledge-sources/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete knowledge source');
        return response.json();
    }
};