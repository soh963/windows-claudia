import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

let claudiaPanel: vscode.WebviewPanel | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Claudia VS Code extension is now active!');

    // Register commands
    const openClaudiaPanel = vscode.commands.registerCommand('claudia.openPanel', () => {
        createClaudiaPanel(context);
    });

    const newChat = vscode.commands.registerCommand('claudia.newChat', () => {
        createClaudiaPanel(context);
        // Focus on new chat functionality
    });

    const analyzeCurrentFile = vscode.commands.registerCommand('claudia.analyzeCurrentFile', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            const fileName = document.fileName;
            const fileContent = document.getText();
            
            // Open Claudia with the current file context
            createClaudiaPanel(context, {
                type: 'analyzeFile',
                fileName,
                fileContent
            });
            
            vscode.window.showInformationMessage(`Analyzing file: ${path.basename(fileName)}`);
        } else {
            vscode.window.showWarningMessage('No active editor found');
        }
    });

    const analyzeProject = vscode.commands.registerCommand('claudia.analyzeProject', () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            const projectPath = workspaceFolder.uri.fsPath;
            
            // Open Claudia with the project context
            createClaudiaPanel(context, {
                type: 'analyzeProject',
                projectPath
            });
            
            vscode.window.showInformationMessage(`Analyzing project: ${path.basename(projectPath)}`);
        } else {
            vscode.window.showWarningMessage('No workspace folder found');
        }
    });

    // Add commands to subscriptions
    context.subscriptions.push(openClaudiaPanel, newChat, analyzeCurrentFile, analyzeProject);

    // Auto-start if configured
    const config = vscode.workspace.getConfiguration('claudia');
    if (config.get('autoStart')) {
        createClaudiaPanel(context);
    }

    // Show welcome message
    vscode.window.showInformationMessage(
        'Claudia VS Code extension loaded! Use Ctrl+Shift+C to open Claudia panel.',
        'Open Claudia'
    ).then(selection => {
        if (selection === 'Open Claudia') {
            createClaudiaPanel(context);
        }
    });
}

function createClaudiaPanel(context: vscode.ExtensionContext, initialData?: any) {
    // If panel already exists, show it
    if (claudiaPanel) {
        claudiaPanel.reveal(vscode.ViewColumn.One);
        if (initialData) {
            claudiaPanel.webview.postMessage(initialData);
        }
        return;
    }

    // Create new webview panel
    claudiaPanel = vscode.window.createWebviewPanel(
        'claudia',
        'Claudia - Claude AI Assistant',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(context.extensionPath, 'webview'))
            ],
            retainContextWhenHidden: true
        }
    );

    // Set the webview's HTML content
    claudiaPanel.webview.html = getWebviewContent(context, claudiaPanel.webview);

    // Handle messages from the webview
    claudiaPanel.webview.onDidReceiveMessage(
        message => {
            switch (message.command) {
                case 'alert':
                    vscode.window.showInformationMessage(message.text);
                    return;
                case 'getWorkspaceInfo':
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                    claudiaPanel?.webview.postMessage({
                        command: 'workspaceInfo',
                        data: {
                            workspacePath: workspaceFolder?.uri.fsPath,
                            workspaceName: workspaceFolder?.name
                        }
                    });
                    return;
                case 'readFile':
                    readFileForWebview(message.filePath);
                    return;
            }
        },
        undefined,
        context.subscriptions
    );

    // Handle panel disposal
    claudiaPanel.onDidDispose(
        () => {
            claudiaPanel = undefined;
        },
        null,
        context.subscriptions
    );

    // Send initial data if provided
    if (initialData) {
        setTimeout(() => {
            claudiaPanel?.webview.postMessage(initialData);
        }, 1000);
    }
}

function getWebviewContent(context: vscode.ExtensionContext, webview: vscode.Webview): string {
    // Read the built Claudia dist files
    const distPath = path.join(context.extensionPath, '..', 'dist');
    
    // Check if dist folder exists
    if (!fs.existsSync(distPath)) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Claudia</title>
        </head>
        <body>
            <div style="padding: 20px; text-align: center; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <h2>Claudia Build Not Found</h2>
                <p>Please run <code>bun run build</code> in the main Claudia directory to generate the required files.</p>
                <p>Expected location: <code>${distPath}</code></p>
            </div>
        </body>
        </html>`;
    }

    // Read the built HTML file
    const htmlPath = path.join(distPath, 'index.html');
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // Convert relative paths to webview URIs
    const baseUri = webview.asWebviewUri(vscode.Uri.file(distPath));
    
    // Replace relative asset paths with webview URIs
    htmlContent = htmlContent.replace(
        /(\/assets\/[^"'\s>]+)/g,
        (match) => `${baseUri}${match}`
    );

    // Add VSCode integration script
    const vscodeScript = `
        <script>
            (function() {
                const vscode = acquireVsCodeApi();
                
                // Make vscode API available globally
                window.vscode = vscode;
                
                // VSCode integration functions
                window.vscodeIntegration = {
                    getWorkspaceInfo: () => {
                        vscode.postMessage({ command: 'getWorkspaceInfo' });
                    },
                    readFile: (filePath) => {
                        vscode.postMessage({ command: 'readFile', filePath });
                    },
                    showMessage: (message) => {
                        vscode.postMessage({ command: 'alert', text: message });
                    }
                };
                
                // Listen for messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'workspaceInfo') {
                        // Dispatch custom event with workspace info
                        window.dispatchEvent(new CustomEvent('vscode-workspace-info', {
                            detail: message.data
                        }));
                    }
                });
                
                // Override Tauri APIs to prevent errors
                if (!window.__TAURI__) {
                    window.__TAURI__ = {
                        invoke: () => Promise.reject('Tauri not available in VSCode'),
                        event: {
                            listen: () => Promise.resolve(() => {}),
                            emit: () => Promise.resolve()
                        }
                    };
                }
            })();
        </script>
    `;

    // Insert the VSCode script before closing head tag
    htmlContent = htmlContent.replace('</head>', `${vscodeScript}</head>`);

    return htmlContent;
}

async function readFileForWebview(filePath: string) {
    try {
        const fileUri = vscode.Uri.file(filePath);
        const document = await vscode.workspace.openTextDocument(fileUri);
        const content = document.getText();
        
        claudiaPanel?.webview.postMessage({
            command: 'fileContent',
            data: {
                filePath,
                content
            }
        });
    } catch (error) {
        claudiaPanel?.webview.postMessage({
            command: 'error',
            data: {
                message: `Failed to read file: ${filePath}`,
                error: error
            }
        });
    }
}

export function deactivate() {
    if (claudiaPanel) {
        claudiaPanel.dispose();
        claudiaPanel = undefined;
    }
}