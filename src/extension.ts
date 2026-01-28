import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// =============================================================================
// [Configuration] Data Definitions
// =============================================================================
const colorMap: { [key: string]: string } = {
    '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
    '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
    '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
    'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF'
};

const formatMap: { [key: string]: string } = {
    'l': 'font-weight: bold;',
    'm': 'text-decoration: line-through;',
    'n': 'text-decoration: underline;',
    'o': 'font-style: italic;',
    'k': 'opacity: 0.5;'
};

const completionInfo: { [key: string]: { name: string, color?: string } } = {
    '0': { name: 'Black', color: '#000000' }, '1': { name: 'Dark Blue', color: '#0000AA' },
    '2': { name: 'Dark Green', color: '#00AA00' }, '3': { name: 'Dark Aqua', color: '#00AAAA' },
    '4': { name: 'Dark Red', color: '#AA0000' }, '5': { name: 'Dark Purple', color: '#AA00AA' },
    '6': { name: 'Gold', color: '#FFAA00' }, '7': { name: 'Gray', color: '#AAAAAA' },
    '8': { name: 'Dark Gray', color: '#555555' }, '9': { name: 'Blue', color: '#5555FF' },
    'a': { name: 'Green', color: '#55FF55' }, 'b': { name: 'Aqua', color: '#55FFFF' },
    'c': { name: 'Red', color: '#FF5555' }, 'd': { name: 'Light Purple', color: '#FF55FF' },
    'e': { name: 'Yellow', color: '#FFFF55' }, 'f': { name: 'White', color: '#FFFFFF' },
    'k': { name: 'Obfuscated' }, 'l': { name: 'Bold' }, 'm': { name: 'Strikethrough' },
    'n': { name: 'Underline' }, 'o': { name: 'Italic' }, 'r': { name: 'Reset' }
};

let isScrollSyncEnabled = false;
let isSyncing = false;

export function activate(context: vscode.ExtensionContext) {

    // =========================================================================
    // Feature 1: Create New Language File
    // =========================================================================
    const createLangFileCommand = vscode.commands.registerCommand('minecraft-translator.createLangFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active JSON file found.");
            return;
        }
        try {
            const text = editor.document.getText();
            const keyRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"\s*:/g;
            const newJson: { [key: string]: string } = {};
            
            let match;
            while ((match = keyRegex.exec(text)) !== null) {
                newJson[match[1]] = "";
            }

            if (Object.keys(newJson).length === 0) {
                const parsed = JSON.parse(text);
                for (const key in parsed) {
                    newJson[key] = "";
                }
            }

            const uri = await vscode.window.showSaveDialog({
                defaultUri: editor.document.uri,
                filters: { 'JSON': ['json'] },
                title: "Save New Language File"
            });
            if (uri) {
                const newContent = JSON.stringify(newJson, null, 4);
                await vscode.workspace.fs.writeFile(uri, Buffer.from(newContent, 'utf8'));
                const doc = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
            }
        } catch (e) {
            vscode.window.showErrorMessage("Error creating file.");
        }
    });
    context.subscriptions.push(createLangFileCommand);


    // =========================================================================
    // Feature 2: Scroll Sync
    // =========================================================================
    const toggleSyncCommand = vscode.commands.registerCommand('minecraft-translator.toggleScrollSync', () => {
        isScrollSyncEnabled = !isScrollSyncEnabled;
        vscode.window.showInformationMessage(`Scroll Sync: ${isScrollSyncEnabled ? 'ON' : 'OFF'}`);
    });
    context.subscriptions.push(toggleSyncCommand);

    const scrollListener = vscode.window.onDidChangeTextEditorVisibleRanges(e => {
        if (!isScrollSyncEnabled || isSyncing) { return; }
        if (vscode.window.activeTextEditor !== e.textEditor) { return; }

        isSyncing = true;
        const topLine = e.visibleRanges[0].start.line;

        vscode.window.visibleTextEditors.forEach(otherEditor => {
            if (otherEditor !== e.textEditor && otherEditor.viewColumn !== e.textEditor.viewColumn) {
                const range = new vscode.Range(topLine, 0, topLine, 0);
                otherEditor.revealRange(range, vscode.TextEditorRevealType.AtTop);
            }
        });
        setTimeout(() => { isSyncing = false; }, 50);
    });
    context.subscriptions.push(scrollListener);


    // =========================================================================
    // Feature 3: Validation (Robust)
    // =========================================================================
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('minecraft-json');
    context.subscriptions.push(diagnosticCollection);

    const validateJson = (doc: vscode.TextDocument) => {
        if (doc.languageId !== 'json' && doc.languageId !== 'jsonc') { return; }
        
        const fileName = path.basename(doc.fileName);
        const dirPath = path.dirname(doc.fileName);
        const originalPath = path.join(dirPath, 'en_us.json');

        if (fileName === 'en_us.json') { return; }
        if (!fs.existsSync(originalPath)) { return; }

        let originalJson: { [key: string]: any } = {};
        try {
            const originalText = fs.readFileSync(originalPath, 'utf-8');
            originalJson = JSON.parse(originalText);
        } catch (e) { return; }

        const currentText = doc.getText();
        const currentDiagnostics: vscode.Diagnostic[] = [];
        const originalDiagnostics: vscode.Diagnostic[] = [];
        const foundKeys = new Set<string>();

        // Regex Parse
        const pairRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"\s*:\s*("([^"\\]*(?:\\.[^"\\]*)*)"|)/g;
        
        let match;
        while ((match = pairRegex.exec(currentText)) !== null) {
            const key = match[1];
            const valueFull = match[2]; 
            foundKeys.add(key);

            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(match.index + key.length + 2);
            const range = new vscode.Range(startPos, endPos);

            if (!Object.prototype.hasOwnProperty.call(originalJson, key)) {
                currentDiagnostics.push(new vscode.Diagnostic(range, "Original json doesn't have this key!", vscode.DiagnosticSeverity.Error));
            } else if (valueFull === '""') {
                currentDiagnostics.push(new vscode.Diagnostic(range, "Translation is empty!", vscode.DiagnosticSeverity.Warning));
            }
        }

        // Check Missing Keys
        const originalRawText = fs.readFileSync(originalPath, 'utf-8');
        for (const key in originalJson) {
            if (!foundKeys.has(key)) {
                const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const keyRegex = new RegExp(`"${escapedKey}"\\s*:`);
                const matchOrig = keyRegex.exec(originalRawText);
                if (matchOrig) {
                    const textBefore = originalRawText.substring(0, matchOrig.index);
                    const lines = textBefore.split(/\r?\n/);
                    const line = lines.length - 1;
                    const char = lines[lines.length - 1].length;
                    
                    const range = new vscode.Range(line, char, line, char + matchOrig[0].length);
                    originalDiagnostics.push(new vscode.Diagnostic(range, `Missing translation in ${fileName}!`, vscode.DiagnosticSeverity.Error));
                }
            }
        }
        diagnosticCollection.set(doc.uri, currentDiagnostics);
        diagnosticCollection.set(vscode.Uri.file(originalPath), originalDiagnostics);
    };

    // Trigger validation on file change, open, and initialization
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => validateJson(e.document)));
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(doc => validateJson(doc)));
    
    // [FIX] Validate ALL open documents on startup
    vscode.workspace.textDocuments.forEach(doc => validateJson(doc));


    // =========================================================================
    // Feature 4: Preview
    // =========================================================================
    const previewCommand = vscode.commands.registerCommand('minecraft-translator.showPreview', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }
        const panel = vscode.window.createWebviewPanel('minecraftPreview', 'Minecraft Preview', vscode.ViewColumn.Beside, { enableScripts: true });
        
        const update = () => {
            let text = editor.document.getText(editor.selection);
            if (!text) { text = " "; }
            panel.webview.html = generatePreviewHtml(text);
        };
        
        update();
        const changeDoc = vscode.workspace.onDidChangeTextDocument(e => { if (e.document === editor.document) { update(); } });
        const changeSel = vscode.window.onDidChangeTextEditorSelection(e => { if (e.textEditor === editor) { update(); } });
        panel.onDidDispose(() => { changeDoc.dispose(); changeSel.dispose(); }, null, context.subscriptions);
    });
    context.subscriptions.push(previewCommand);


    // =========================================================================
    // Feature 5: Autocomplete
    // =========================================================================
    const completionProvider = vscode.languages.registerCompletionItemProvider(['json', 'jsonc', 'plaintext', 'markdown'], {
        provideCompletionItems(document, position) {
            const linePrefix = document.lineAt(position).text.substr(0, position.character);
            if (!linePrefix.endsWith('&&')) { return undefined; }
            return Object.keys(completionInfo).map(key => {
                const info = completionInfo[key];
                const item = new vscode.CompletionItem(`§${key}`, info.color ? vscode.CompletionItemKind.Color : vscode.CompletionItemKind.Text);
                item.filterText = `&&${key}`; item.insertText = `§${key}`; item.detail = info.name;
                item.range = new vscode.Range(position.translate(0, -2), position);
                return item;
            });
        }
    }, '&');
    context.subscriptions.push(completionProvider);


    // =========================================================================
    // Feature 6: Highlighting
    // =========================================================================
    const decorations = new Map<string, vscode.TextEditorDecorationType>();
    
    function getDecoration(color: string | undefined, bold: boolean, italic: boolean, strike: boolean, underline: boolean, obfuscated: boolean) {
        const key = `${color}-${bold}-${italic}-${strike}-${underline}-${obfuscated}`;
        if (!decorations.has(key)) {
            const options: vscode.DecorationRenderOptions = {};
            if (color) { options.color = color; }
            if (bold) { options.fontWeight = 'bold'; }
            if (italic) { options.fontStyle = 'italic'; }
            if (strike || underline) { options.textDecoration = `${strike ? 'line-through' : ''} ${underline ? 'underline' : ''}`.trim(); }
            if (obfuscated) { options.border = '1px solid #888888'; options.backgroundColor = 'rgba(136, 136, 136, 0.3)'; }
            decorations.set(key, vscode.window.createTextEditorDecorationType(options));
        }
        return decorations.get(key)!;
    }

    // [FIX] Updated to support ALL visible editors, not just active one
    function updateDecorations() {
        for (const editor of vscode.window.visibleTextEditors) {
            if (!editor.document) { continue; }
            
            const text = editor.document.getText();
            const decorationRanges = new Map<vscode.TextEditorDecorationType, vscode.Range[]>();
            const valueRegex = /"([^"\\]*(?:\\.[^"\\]*)*§[^"\\]*(?:\\.[^"\\]*)*)"/g;
            let match;

            while ((match = valueRegex.exec(text)) !== null) {
                const content = match[1];
                const startOffset = match.index + 1;
                let currentColor: string | undefined = undefined;
                let isBold = false, isItalic = false, isStrike = false, isUnderline = false, isObfuscated = false;
                let currentRangeStart = -1;

                for (let i = 0; i < content.length; i++) {
                    if (content[i] === '§' && i + 1 < content.length) {
                        if (currentRangeStart !== -1) {
                            const deco = getDecoration(currentColor, isBold, isItalic, isStrike, isUnderline, isObfuscated);
                            const range = new vscode.Range(editor.document.positionAt(startOffset + currentRangeStart), editor.document.positionAt(startOffset + i));
                            if (!decorationRanges.has(deco)) { decorationRanges.set(deco, []); }
                            decorationRanges.get(deco)!.push(range);
                        }
                        const code = content[i + 1].toLowerCase();
                        if (colorMap[code]) { currentColor = colorMap[code]; isBold = isItalic = isStrike = isUnderline = isObfuscated = false; }
                        else if (code === 'l') { isBold = true; } else if (code === 'o') { isItalic = true; }
                        else if (code === 'm') { isStrike = true; } else if (code === 'n') { isUnderline = true; }
                        else if (code === 'k') { isObfuscated = true; } else if (code === 'r') { currentColor = undefined; isBold = isItalic = isStrike = isUnderline = isObfuscated = false; }
                        const hasEffect = currentColor !== undefined || isBold || isItalic || isStrike || isUnderline || isObfuscated;
                        currentRangeStart = hasEffect ? i + 2 : -1;
                        i++; continue;
                    }
                }
                if (currentRangeStart !== -1 && currentRangeStart < content.length) {
                    const deco = getDecoration(currentColor, isBold, isItalic, isStrike, isUnderline, isObfuscated);
                    const range = new vscode.Range(editor.document.positionAt(startOffset + currentRangeStart), editor.document.positionAt(startOffset + content.length));
                    if (!decorationRanges.has(deco)) { decorationRanges.set(deco, []); }
                    decorationRanges.get(deco)!.push(range);
                }
            }
            
            // Apply decorations to THIS specific editor
            decorations.forEach(deco => editor.setDecorations(deco, []));
            decorationRanges.forEach((ranges, deco) => editor.setDecorations(deco, ranges));
        }
    }

    vscode.workspace.onDidChangeTextDocument(() => updateDecorations(), null, context.subscriptions);
    vscode.window.onDidChangeActiveTextEditor(() => updateDecorations(), null, context.subscriptions);
    vscode.window.onDidChangeVisibleTextEditors(() => updateDecorations(), null, context.subscriptions); // [FIX] Trigger on visibility change
    
    // [FIX] Run initial highlight on all visible editors
    updateDecorations();
}

function generatePreviewHtml(text: string): string {
    const lines = text.split(/\r?\n/);
    let htmlBody = '';
    lines.forEach(line => {
        let lineHtml = '';
        let currentStyle = 'color: #FFFFFF;'; 
        let buffer = '';
        const flushBuffer = () => { if (buffer.length > 0) { lineHtml += `<span style="${currentStyle}">${buffer}</span>`; buffer = ''; } };
        let color = 'color: #FFFFFF;'; 
        let bold = '', italic = '', strike = '', underline = '', obfuscated = '';
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '§' && i + 1 < line.length) {
                flushBuffer();
                const code = line[i + 1].toLowerCase();
                if (colorMap[code]) { color = `color: ${colorMap[code]};`; bold = italic = strike = underline = obfuscated = ''; } 
                else if (code === 'l') { bold = formatMap['l']; } else if (code === 'm') { strike = formatMap['m']; }
                else if (code === 'n') { underline = formatMap['n']; } else if (code === 'o') { italic = formatMap['o']; }
                else if (code === 'k') { obfuscated = formatMap['k']; } else if (code === 'r') { color = 'color: #FFFFFF;'; bold = italic = strike = underline = obfuscated = ''; }
                currentStyle = `${color} ${bold} ${italic} ${strike} ${underline} ${obfuscated}`;
                i++;
            } else {
                const char = line[i];
                if(char === '<') { buffer += '&lt;'; } else if(char === '>') { buffer += '&gt;'; }
                else if(char === '&') { buffer += '&amp;'; } else { buffer += char; }
            }
        }
        flushBuffer();
        htmlBody += `<div>${lineHtml || '&nbsp;'}</div>`;
    });
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><style>body{font-family:'Minecraft','Consolas',monospace;padding:20px;font-size:14px;line-height:1.5;background-color:#1e1e1e;color:#FFFFFF;}.controls{position:fixed;top:10px;right:10px;z-index:1000;}button{cursor:pointer;padding:8px 12px;background:#444;color:white;border:1px solid #666;border-radius:4px;font-size:12px;}button:hover{background:#666;}.bg-dark{background-color:#1e1e1e;}.bg-light{background-color:#ffffff;}</style></head><body class="bg-dark"><div class="controls"><button onclick="toggleTheme()">🌗 Toggle Theme (B/W)</button></div><div id="content">${htmlBody}</div><script>const body=document.body;function toggleTheme(){if(body.classList.contains('bg-dark')){body.classList.remove('bg-dark');body.classList.add('bg-light');}else{body.classList.remove('bg-light');body.classList.add('bg-dark');}}</script></body></html>`;
}