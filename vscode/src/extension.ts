// 在 VS Code／Cursor 裡打開舊版 LF2 的 .dat：自訂編輯器直接顯示解密文字，指令則開到一般文字編輯器。
// Opens an old LF2 .dat in VS Code / Cursor: the custom editor shows the decrypted text, and a command opens the normal text editor.

import * as vscode from 'vscode'
import { decodeLf2Dat } from './decode'

const SCHEME = 'lf2-dat'
const VIEW = 'lf2.dat'

class DatDocument implements vscode.CustomDocument {
  constructor(readonly uri: vscode.Uri) {}
  dispose() {}
}

function fileUri(uri: vscode.Uri): vscode.Uri {
  // 文字頁的路徑多了 .lf2.txt，避免再被 *.dat 的自訂編輯器接走。
  // The text tab's path ends in .lf2.txt, so the *.dat custom editor does not take it again.
  if (uri.scheme === SCHEME && uri.path.endsWith('.lf2.txt')) {
    return uri.with({ scheme: 'file', path: uri.path.slice(0, -'.lf2.txt'.length) })
  }
  return uri.scheme === 'file' ? uri : uri.with({ scheme: 'file' })
}

function virtualUri(uri: vscode.Uri): vscode.Uri {
  const file = fileUri(uri)
  return file.with({ scheme: SCHEME, path: file.path + '.lf2.txt' })
}

async function readDecoded(uri: vscode.Uri): Promise<string | null> {
  const bytes = await vscode.workspace.fs.readFile(fileUri(uri))
  return decodeLf2Dat(bytes)
}

function page(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<style>
  html, body { height: 100%; margin: 0; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
  header { position: sticky; top: 0; display: flex; gap: 8px; align-items: center; padding: 8px 12px; background: var(--vscode-sideBar-background); }
  button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; padding: 4px 10px; }
  pre { margin: 0; padding: 12px 16px 32px; font-family: var(--vscode-editor-font-family, monospace); font-size: var(--vscode-editor-font-size, 13px); white-space: pre; tab-size: 4; }
  p { padding: 16px; }
</style>
</head>
<body>${body}</body>
</html>`
}

function decodedPage(text: string): string {
  const payload = JSON.stringify(text).replace(/</g, '\\u003c')
  return page(`<header><button id="asText" type="button">Open in Text Editor</button></header>
<pre id="out"></pre>
<script>
const vscode = acquireVsCodeApi()
document.getElementById('out').textContent = ${payload}
document.getElementById('asText').onclick = () => vscode.postMessage({ type: 'openText' })
</script>`)
}

function rejectedPage(): string {
  return page(`<header><button id="normal" type="button">Open With Default Editor</button></header>
<p>This file is not Little Fighter 2 data. The decoder only accepts old LF2 object, background, and stage files.</p>
<script>
const vscode = acquireVsCodeApi()
document.getElementById('normal').onclick = () => vscode.postMessage({ type: 'openDefault' })
</script>`)
}

// 解密後的文字用虛擬文件打開，不能存回 .dat。 / The decrypted text opens as a virtual document, so it cannot be saved back over the .dat.
async function openAsText(uri: vscode.Uri) {
  const text = await readDecoded(uri)
  if (text == null) {
    vscode.window.showWarningMessage('LF2: this file is not LF2 data.')
    return
  }
  const virtual = virtualUri(uri)
  const document = await vscode.workspace.openTextDocument(virtual)
  await vscode.languages.setTextDocumentLanguage(document, 'lf2-data')
  await vscode.window.showTextDocument(document, { preview: false })
}

export function activate(context: vscode.ExtensionContext) {
  const provider: vscode.TextDocumentContentProvider = {
    provideTextDocumentContent(uri) {
      return readDecoded(uri).then((text) => text ?? '')
    },
  }
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(SCHEME, provider))

  context.subscriptions.push(
    vscode.commands.registerCommand('lf2.openDat', async (resource?: vscode.Uri) => {
      const uri = resource ?? (await currentDatUri())
      if (!uri) return
      await openAsText(uri)
    }),
  )

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      VIEW,
      {
        openCustomDocument(uri) {
          return new DatDocument(uri)
        },
        async resolveCustomEditor(document, panel) {
          let text: string | null = null
          try {
            text = await readDecoded(document.uri)
          } catch (error) {
            panel.webview.html = page(`<p>LF2: cannot read this file (${String(error)}).</p>`)
            return
          }
          panel.webview.options = { enableScripts: true }
          panel.webview.html = text == null ? rejectedPage() : decodedPage(text)
          const messages = panel.webview.onDidReceiveMessage(async (message: { type?: string }) => {
            if (message.type == 'openText') await openAsText(document.uri)
            if (message.type == 'openDefault') {
              await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default')
            }
          })
          panel.onDidDispose(() => messages.dispose())
        },
      },
      { webviewOptions: { retainContextWhenHidden: true, enableFindWidget: true } },
    ),
  )
}

async function currentDatUri(): Promise<vscode.Uri | undefined> {
  const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input
  if (input instanceof vscode.TabInputCustom && input.viewType == VIEW) return input.uri
  if (input instanceof vscode.TabInputText && input.uri.scheme == 'file' && input.uri.fsPath.toLowerCase().endsWith('.dat')) {
    return input.uri
  }
  const picked = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: { 'LF2 data': ['dat'] },
    title: 'Open LF2 data',
  })
  return picked?.[0]
}

export function deactivate() {}
