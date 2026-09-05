/**
 * Secure Calculator & Hidden Vault - Core Logic Application
 * Handles calculator engine, dual secret triggers, IndexedDB secret file/note vault, and user settings.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. CONFIGURATION & STATE MANAGEMENT
    // ==========================================
    const DEFAULT_PASSCODE = '1234';
    const DEFAULT_QUICK_MSG = 'Welcome back, Agent. The vault is secure. Enter passcode 1234 followed by = to access full hidden files and notes.';
    
    let currentInput = '0';
    let previousExpression = '';
    let isEvaluated = false;
    let calcHistoryTape = [];
    
    // Passcode State
    let activePasscode = localStorage.getItem('secureCalcPasscode') || DEFAULT_PASSCODE;
    let activeQuickMsg = localStorage.getItem('secureCalcQuickMsg') || DEFAULT_QUICK_MSG;

    // Long Press Timer State
    let longPressTimer = null;
    let isLongPressTriggered = false;
    const LONG_PRESS_DURATION = 700; // ms

    // Active Vault Data Cache
    let currentNotes = [];
    let currentFiles = [];

    // ==========================================
    // 2. DOM ELEMENT REFERENCES
    // ==========================================
    const calcDisplay = document.getElementById('calcDisplay');
    const calcHistoryText = document.getElementById('calcHistoryText');
    const historyToggleBtn = document.getElementById('historyToggleBtn');
    const historyPanel = document.getElementById('historyPanel');
    const historyList = document.getElementById('historyList');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    
    const btnAC = document.getElementById('btnAC');
    const btnEquals = document.getElementById('btnEquals');
    const keypad = document.querySelector('.calc-keypad');

    // Modals
    const secretMessageModal = document.getElementById('secretMessageModal');
    const quickMessageContent = document.getElementById('quickMessageContent');
    const closeSecretMsgBtn = document.getElementById('closeSecretMsgBtn');

    const vaultModal = document.getElementById('vaultModal');
    const closeVaultBtn = document.getElementById('closeVaultBtn');

    // Vault Tabs & Panes
    const vaultTabs = document.querySelectorAll('.vault-tabs .tab-btn');
    const tabPanes = document.querySelectorAll('.vault-content .tab-pane');

    // File Vault Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const browseFilesBtn = document.getElementById('browseFilesBtn');
    const filesGrid = document.getElementById('filesGrid');
    const fileCountSpan = document.getElementById('fileCount');

    // Notes Vault Elements
    const newNoteBtn = document.getElementById('newNoteBtn');
    const noteEditor = document.getElementById('noteEditor');
    const noteTitleInput = document.getElementById('noteTitleInput');
    const noteBodyInput = document.getElementById('noteBodyInput');
    const saveNoteBtn = document.getElementById('saveNoteBtn');
    const cancelNoteBtn = document.getElementById('cancelNoteBtn');
    const notesGrid = document.getElementById('notesGrid');
    const noteSearch = document.getElementById('noteSearch');

    // Settings Elements
    const changePasscodeForm = document.getElementById('changePasscodeForm');
    const currentPasscodeIn = document.getElementById('currentPasscode');
    const newPasscodeIn = document.getElementById('newPasscode');
    const confirmPasscodeIn = document.getElementById('confirmPasscode');
    const passcodeFormMsg = document.getElementById('passcodeFormMsg');

    const customQuickMsgIn = document.getElementById('customQuickMsg');
    const saveQuickMsgBtn = document.getElementById('saveQuickMsgBtn');
    const clearVaultDataBtn = document.getElementById('clearVaultDataBtn');

    // File Preview Modal
    const filePreviewModal = document.getElementById('filePreviewModal');
    const previewTitle = document.getElementById('previewTitle');
    const previewBody = document.getElementById('previewBody');
    const previewMeta = document.getElementById('previewMeta');
    const downloadFileBtn = document.getElementById('downloadFileBtn');
    const closePreviewBtn = document.getElementById('closePreviewBtn');

    // ==========================================
    // 3. INDEXEDDB STORAGE SYSTEM (VaultDB)
    // ==========================================
    class VaultDB {
        constructor() {
            this.dbName = 'SecureCalculatorVaultDB';
            this.dbVersion = 1;
            this.db = null;
        }

        async init() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, this.dbVersion);

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('notes')) {
                        db.createObjectStore('notes', { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains('files')) {
                        db.createObjectStore('files', { keyPath: 'id' });
                    }
                };

                request.onsuccess = (event) => {
                    this.db = event.target.result;
                    resolve(this.db);
                };

                request.onerror = (event) => {
                    console.error('IndexedDB Error:', event.target.error);
                    reject(event.target.error);
                };
            });
        }

        // --- NOTES CRUD ---
        async getAllNotes() {
            return new Promise((resolve) => {
                const tx = this.db.transaction('notes', 'readonly');
                const store = tx.objectStore('notes');
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve([]);
            });
        }

        async saveNote(note) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction('notes', 'readwrite');
                const store = tx.objectStore('notes');
                const request = store.put(note);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

        async deleteNote(id) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction('notes', 'readwrite');
                const store = tx.objectStore('notes');
                const request = store.delete(id);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }

        // --- FILES CRUD ---
        async getAllFiles() {
            return new Promise((resolve) => {
                const tx = this.db.transaction('files', 'readonly');
                const store = tx.objectStore('files');
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve([]);
            });
        }

        async saveFile(fileData) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction('files', 'readwrite');
                const store = tx.objectStore('files');
                const request = store.put(fileData);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

        async deleteFile(id) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction('files', 'readwrite');
                const store = tx.objectStore('files');
                const request = store.delete(id);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }

        async clearAll() {
            return new Promise((resolve) => {
                const tx = this.db.transaction(['notes', 'files'], 'readwrite');
                tx.objectStore('notes').clear();
                tx.objectStore('files').clear();
                tx.oncomplete = () => resolve();
            });
        }
    }

    const vaultDb = new VaultDB();
    vaultDb.init().then(() => {
        loadVaultNotes();
        loadVaultFiles();
    });

    // ==========================================
    // 4. CALCULATOR ENGINE LOGIC
    // ==========================================
    function updateDisplay() {
        calcDisplay.value = currentInput;
        calcHistoryText.textContent = previousExpression;
    }

    function appendNumber(num) {
        if (isEvaluated) {
            currentInput = num;
            isEvaluated = false;
        } else {
            if (currentInput === '0') {
                currentInput = num;
            } else {
                currentInput += num;
            }
        }
        updateDisplay();
    }

    function appendDecimal() {
        if (isEvaluated) {
            currentInput = '0.';
            isEvaluated = false;
            updateDisplay();
            return;
        }

        // Find last number token in expression
        const parts = currentInput.split(/[\+\−\×\÷]/);
        const lastPart = parts[parts.length - 1];
        if (!lastPart.includes('.')) {
            currentInput += '.';
            updateDisplay();
        }
    }

    function handleOperator(opSymbol) {
        if (isEvaluated) {
            isEvaluated = false;
        }

        const lastChar = currentInput.slice(-1);
        if (['+', '−', '×', '÷'].includes(lastChar)) {
            currentInput = currentInput.slice(0, -1) + opSymbol;
        } else {
            currentInput += opSymbol;
        }
        updateDisplay();
    }

    function clearAll() {
        currentInput = '0';
        previousExpression = '';
        isEvaluated = false;
        updateDisplay();
    }

    function deleteLastChar() {
        if (isEvaluated) {
            clearAll();
            return;
        }
        if (currentInput.length === 1 || currentInput === 'Error') {
            currentInput = '0';
        } else {
            currentInput = currentInput.slice(0, -1);
        }
        updateDisplay();
    }

    function toggleNegation() {
        if (currentInput === '0' || currentInput === 'Error') return;
        if (currentInput.startsWith('-')) {
            currentInput = currentInput.slice(1);
        } else {
            currentInput = '-' + currentInput;
        }
        updateDisplay();
    }

    function handlePercent() {
        try {
            const val = parseFloat(currentInput);
            if (!isNaN(val)) {
                currentInput = (val / 100).toString();
                updateDisplay();
            }
        } catch (e) {
            currentInput = 'Error';
            updateDisplay();
        }
    }

    // Evaluate Math Expression safely
    function evaluateExpression() {
        // --- TRIGGER A CHECK: PASSCODE MATCH ---
        // Clean display text to check if secret passcode was typed
        const sanitizedInput = currentInput.trim();
        if (sanitizedInput === activePasscode) {
            // Unlock Secret Vault!
            clearAll();
            openVaultModal();
            return;
        }

        // Standard Math Evaluation
        let exp = currentInput.replace(/×/g, '*').replace(/−/g, '-').replace(/÷/g, '/');
        
        try {
            // Standard evaluation using Function constructor for calculator math
            const result = Function(`'use strict'; return (${exp})`)();
            
            if (result === undefined || isNaN(result) || !isFinite(result)) {
                previousExpression = `${currentInput} =`;
                currentInput = 'Error';
            } else {
                const formattedResult = Number.isInteger(result) ? result.toString() : parseFloat(result.toFixed(8)).toString();
                previousExpression = `${currentInput} =`;
                
                // Save to History
                calcHistoryTape.unshift({ exp: currentInput, result: formattedResult });
                renderHistory();
                
                currentInput = formattedResult;
            }
            isEvaluated = true;
        } catch (err) {
            previousExpression = `${currentInput} =`;
            currentInput = 'Error';
            isEvaluated = true;
        }
        updateDisplay();
    }

    function renderHistory() {
        if (calcHistoryTape.length === 0) {
            historyList.innerHTML = `<div class="empty-history">No past calculations</div>`;
            return;
        }
        historyList.innerHTML = calcHistoryTape.map(item => `
            <div class="history-item" data-val="${item.result}">
                <span>${item.exp}</span>
                <strong>= ${item.result}</strong>
            </div>
        `).join('');

        historyList.querySelectorAll('.history-item').forEach(el => {
            el.addEventListener('click', () => {
                currentInput = el.getAttribute('data-val');
                isEvaluated = true;
                updateDisplay();
            });
        });
    }

    // ==========================================
    // 5. KEYPAD & TRIGGER B (LONG PRESS) HANDLERS
    // ==========================================
    // Trigger B: Long Press AC Button to open Secret Quick Message Modal
    function setupLongPressTrigger(element) {
        const start = (e) => {
            isLongPressTriggered = false;
            longPressTimer = setTimeout(() => {
                isLongPressTriggered = true;
                openSecretMessageModal();
            }, LONG_PRESS_DURATION);
        };

        const cancel = () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        };

        element.addEventListener('pointerdown', start);
        element.addEventListener('pointerup', cancel);
        element.addEventListener('pointerleave', cancel);
        element.addEventListener('pointercancel', cancel);
    }

    setupLongPressTrigger(btnAC);

    // Keypad Click Event Delegation
    keypad.addEventListener('click', (e) => {
        const target = e.target.closest('.btn');
        if (!target) return;

        // If long press triggered the secret message modal, ignore the short click action
        if (target.id === 'btnAC' && isLongPressTriggered) {
            isLongPressTriggered = false;
            return;
        }

        const num = target.getAttribute('data-num');
        const action = target.getAttribute('data-action');

        if (num !== null) {
            appendNumber(num);
            return;
        }

        switch (action) {
            case 'all-clear':
                clearAll();
                break;
            case 'delete':
                deleteLastChar();
                break;
            case 'percent':
                handlePercent();
                break;
            case 'negate':
                toggleNegation();
                break;
            case 'decimal':
                appendDecimal();
                break;
            case 'add':
                handleOperator('+');
                break;
            case 'subtract':
                handleOperator('−');
                break;
            case 'multiply':
                handleOperator('×');
                break;
            case 'divide':
                handleOperator('÷');
                break;
            case 'calculate':
                evaluateExpression();
                break;
        }
    });

    // Keyboard Shortcuts Listener
    document.addEventListener('keydown', (e) => {
        // Ignore typing keyboard shortcuts when modals or note editor input are active
        if (!vaultModal.classList.contains('hidden') || !secretMessageModal.classList.contains('hidden')) {
            return;
        }

        if (e.key >= '0' && e.key <= '9') {
            appendNumber(e.key);
        } else if (e.key === '.') {
            appendDecimal();
        } else if (e.key === '+') {
            handleOperator('+');
        } else if (e.key === '-') {
            handleOperator('−');
        } else if (e.key === '*') {
            handleOperator('×');
        } else if (e.key === '/') {
            e.preventDefault();
            handleOperator('÷');
        } else if (e.key === '%') {
            handlePercent();
        } else if (e.key === 'Enter' || e.key === '=') {
            e.preventDefault();
            evaluateExpression();
        } else if (e.key === 'Backspace') {
            deleteLastChar();
        } else if (e.key === 'Escape') {
            clearAll();
        }
    });

    // History Toggle & Clear
    historyToggleBtn.addEventListener('click', () => {
        historyPanel.classList.toggle('hidden');
    });

    clearHistoryBtn.addEventListener('click', () => {
        calcHistoryTape = [];
        renderHistory();
    });

    // ==========================================
    // 6. SECRET MODAL MANAGERS
    // ==========================================
    function openSecretMessageModal() {
        quickMessageContent.innerHTML = `"${escapeHtml(activeQuickMsg)}"`;
        secretMessageModal.classList.remove('hidden');
    }

    closeSecretMsgBtn.addEventListener('click', () => {
        secretMessageModal.classList.add('hidden');
    });

    function openVaultModal() {
        vaultModal.classList.remove('hidden');
        loadVaultNotes();
        loadVaultFiles();
    }

    closeVaultBtn.addEventListener('click', () => {
        vaultModal.classList.add('hidden');
    });

    // Tab Navigation
    vaultTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetPaneId = tab.getAttribute('data-tab');
            
            vaultTabs.forEach(t => t.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(targetPaneId).classList.add('active');
        });
    });

    // ==========================================
    // 7. SECRET NOTES MANAGEMENT
    // ==========================================
    async function loadVaultNotes() {
        currentNotes = await vaultDb.getAllNotes();
        renderNotes(currentNotes);
    }

    function renderNotes(notes) {
        if (notes.length === 0) {
            notesGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem 0;">
                    No secret notes stored. Click "New Secret Note" to create one.
                </div>`;
            return;
        }

        notesGrid.innerHTML = notes.map(note => `
            <div class="note-card" data-id="${note.id}">
                <div class="note-card-header">
                    <span class="note-card-title">${escapeHtml(note.title || 'Untitled Note')}</span>
                    <span class="note-card-date">${new Date(note.createdAt).toLocaleDateString()}</span>
                </div>
                <div class="note-card-body">${escapeHtml(note.body)}</div>
                <div class="note-card-actions">
                    <button class="icon-action-btn edit-note-btn" title="Edit Note">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>
                    <button class="icon-action-btn btn-del delete-note-btn" title="Delete Note">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
        `).join('');

        // Attach Note Action Event Handlers
        notesGrid.querySelectorAll('.note-card').forEach(card => {
            const id = parseInt(card.getAttribute('data-id'));
            
            card.querySelector('.edit-note-btn').addEventListener('click', () => {
                const noteToEdit = currentNotes.find(n => n.id === id);
                if (noteToEdit) {
                    noteTitleInput.value = noteToEdit.title;
                    noteBodyInput.value = noteToEdit.body;
                    noteEditor.setAttribute('data-editing-id', id);
                    noteEditor.classList.remove('hidden');
                }
            });

            card.querySelector('.delete-note-btn').addEventListener('click', async () => {
                if (confirm('Delete this secret note permanently?')) {
                    await vaultDb.deleteNote(id);
                    loadVaultNotes();
                }
            });
        });
    }

    newNoteBtn.addEventListener('click', () => {
        noteTitleInput.value = '';
        noteBodyInput.value = '';
        noteEditor.removeAttribute('data-editing-id');
        noteEditor.classList.remove('hidden');
    });

    cancelNoteBtn.addEventListener('click', () => {
        noteEditor.classList.add('hidden');
    });

    saveNoteBtn.addEventListener('click', async () => {
        const title = noteTitleInput.value.trim();
        const body = noteBodyInput.value.trim();

        if (!title && !body) return;

        const editingId = noteEditor.getAttribute('data-editing-id');
        const noteObj = {
            id: editingId ? parseInt(editingId) : Date.now(),
            title: title || 'Untitled Note',
            body: body,
            createdAt: editingId ? (currentNotes.find(n => n.id === parseInt(editingId))?.createdAt || Date.now()) : Date.now(),
            updatedAt: Date.now()
        };

        await vaultDb.saveNote(noteObj);
        noteEditor.classList.add('hidden');
        loadVaultNotes();
    });

    // Note Live Search Filter
    noteSearch.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = currentNotes.filter(n => 
            n.title.toLowerCase().includes(term) || n.body.toLowerCase().includes(term)
        );
        renderNotes(filtered);
    });

    // ==========================================
    // 8. PROTECTED FILES MANAGEMENT
    // ==========================================
    async function loadVaultFiles() {
        currentFiles = await vaultDb.getAllFiles();
        fileCountSpan.textContent = currentFiles.length;
        renderFiles(currentFiles);
    }

    function renderFiles(files) {
        if (files.length === 0) {
            filesGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem 0;">
                    No files stored in protected vault.
                </div>`;
            return;
        }

        filesGrid.innerHTML = files.map(file => {
            const isImage = file.type.startsWith('image/');
            const objectUrl = isImage ? URL.createObjectURL(file.dataBlob) : null;
            
            return `
                <div class="file-card" data-id="${file.id}">
                    <div class="file-thumb">
                        ${isImage 
                            ? `<img src="${objectUrl}" alt="${escapeHtml(file.name)}">`
                            : `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`
                        }
                    </div>
                    <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
                    <div class="file-size">${formatBytes(file.size)}</div>
                    <div class="file-actions">
                        <button class="icon-action-btn view-file-btn" title="View File">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        <button class="icon-action-btn btn-del delete-file-btn" title="Delete File">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Attach File Event Handlers
        filesGrid.querySelectorAll('.file-card').forEach(card => {
            const id = parseInt(card.getAttribute('data-id'));
            const fileItem = currentFiles.find(f => f.id === id);

            card.querySelector('.view-file-btn').addEventListener('click', () => {
                if (fileItem) openFilePreview(fileItem);
            });

            card.querySelector('.delete-file-btn').addEventListener('click', async () => {
                if (confirm(`Delete file "${fileItem.name}" permanently?`)) {
                    await vaultDb.deleteFile(id);
                    loadVaultFiles();
                }
            });
        });
    }

    // Drag and Drop Upload Handler
    browseFilesBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        handleFileSelect(e.target.files);
    });

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files);
        }
    });

    async function handleFileSelect(files) {
        for (const file of files) {
            const fileData = {
                id: Date.now() + Math.floor(Math.random() * 1000),
                name: file.name,
                size: file.size,
                type: file.type || 'application/octet-stream',
                dataBlob: file,
                uploadedAt: Date.now()
            };
            await vaultDb.saveFile(fileData);
        }
        fileInput.value = '';
        loadVaultFiles();
    }

    // File Preview Modal Handler
    function openFilePreview(file) {
        previewTitle.textContent = file.name;
        previewMeta.textContent = `${formatBytes(file.size)} • ${file.type || 'Unknown Type'}`;

        const blobUrl = URL.createObjectURL(file.dataBlob);
        downloadFileBtn.href = blobUrl;
        downloadFileBtn.download = file.name;

        previewBody.innerHTML = '';

        if (file.type.startsWith('image/')) {
            previewBody.innerHTML = `<img src="${blobUrl}" alt="${escapeHtml(file.name)}">`;
        } else if (file.type.startsWith('video/')) {
            previewBody.innerHTML = `<video src="${blobUrl}" controls autoplay style="max-width:100%;"></video>`;
        } else if (file.type.startsWith('audio/')) {
            previewBody.innerHTML = `<audio src="${blobUrl}" controls autoplay></audio>`;
        } else if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.json')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewBody.innerHTML = `<pre>${escapeHtml(e.target.result)}</pre>`;
            };
            reader.readAsText(file.dataBlob);
        } else {
            previewBody.innerHTML = `
                <div style="text-align:center; padding: 1.5rem; color: var(--text-secondary);">
                    <p style="margin-bottom: 0.8rem;">Preview is not available for this binary file format.</p>
                    <p style="font-size:0.8rem; color: var(--text-muted);">Use the Download button below to save and view this file.</p>
                </div>`;
        }

        filePreviewModal.classList.remove('hidden');
    }

    closePreviewBtn.addEventListener('click', () => {
        filePreviewModal.classList.add('hidden');
    });

    // ==========================================
    // 9. SETTINGS & PASSCODE CUSTOMIZATION
    // ==========================================
    customQuickMsgIn.value = activeQuickMsg;

    changePasscodeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const curr = currentPasscodeIn.value;
        const newCode = newPasscodeIn.value;
        const confirmCode = confirmPasscodeIn.value;

        if (curr !== activePasscode) {
            passcodeFormMsg.className = 'form-msg error';
            passcodeFormMsg.textContent = 'Current passcode is incorrect.';
            return;
        }

        if (newCode.length < 1) {
            passcodeFormMsg.className = 'form-msg error';
            passcodeFormMsg.textContent = 'Passcode cannot be empty.';
            return;
        }

        if (newCode !== confirmCode) {
            passcodeFormMsg.className = 'form-msg error';
            passcodeFormMsg.textContent = 'New passcodes do not match.';
            return;
        }

        activePasscode = newCode;
        localStorage.setItem('secureCalcPasscode', activePasscode);

        changePasscodeForm.reset();
        passcodeFormMsg.className = 'form-msg success';
        passcodeFormMsg.textContent = 'Passcode updated successfully!';
        setTimeout(() => { passcodeFormMsg.textContent = ''; }, 3000);
    });

    saveQuickMsgBtn.addEventListener('click', () => {
        const msg = customQuickMsgIn.value.trim();
        if (msg) {
            activeQuickMsg = msg;
            localStorage.setItem('secureCalcQuickMsg', activeQuickMsg);
            alert('Quick Secret Message updated!');
        }
    });

    clearVaultDataBtn.addEventListener('click', async () => {
        if (confirm('WARNING: Are you sure you want to permanently erase ALL stored secret files and notes from this browser?')) {
            await vaultDb.clearAll();
            loadVaultNotes();
            loadVaultFiles();
            alert('All vault data has been permanently cleared.');
        }
    });

    // Utility functions
    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#039;');
    }
});
