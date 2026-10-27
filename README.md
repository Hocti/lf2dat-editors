# LF2 Data

在 Sublime Text 4 或 Visual Studio Code 裡，直接打開舊版 Little Fighter 2 的 `.dat`（角色、背景、關卡），看成文字。

解密方式和遊戲相同：跳過前 123 個位元組，每個位元組減去金鑰，再用 Big5 解碼（角色名字是繁體中文）。檔案裡如果本來就有 `<bmp_begin>`，當成明文，不再解密。不是 LF2 資料的 `.dat` 會原樣留著。畫面上的文字不能存回原檔。

## 下載

安裝檔在 [Releases](https://github.com/Hocti/lf2dat-editors/releases)。

- `LF2 Data.sublime-package`
- `lf2-data-0.1.0.vsix`

## Sublime Text 4

把 `LF2 Data.sublime-package` 複製到 **Installed Packages**（**Preferences: Browse Packages**，再往上一層），然後重新開啟 Sublime。

之後打開加密的 `.dat`，會多一個唯讀分頁，名稱是 `檔名.dat (LF2)`。明文檔只套上 LF2 Data 語法，仍是原來那個檔。

指令面板：

- **LF2: Open Data File…**
- **LF2: Decode Current File**

若不要自動解密，到 LF2 Data 的設定把 `auto_decode_on_open` 設成 `false`。

## Visual Studio Code

**Extensions: Install from VSIX…**，選 `lf2-data-0.1.0.vsix`。

雙擊 `.dat` 會用 LF2 Data 打開。頁面上方的 **Open in Text Editor**，或指令 **LF2: Open Data as Text**，會把同一份文字開到一般編輯器（可搜尋、有上色），這個分頁也是唯讀。

如果不要每個 `.dat` 都用這個開啟方式，在設定加入：

```json
"workbench.editorAssociations": {
  "*.dat": "default"
}
```

## 自己打包

```bash
cd vscode && npm install && cd ..
node build.mjs
```

成品在 `build/`。有 `lf2_mod` 的範例 `.dat` 時，腳本會比對 Sublime（Python）和 VS Code（Node）解出來的文字是否相同。
