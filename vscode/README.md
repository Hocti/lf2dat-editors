# LF2 Data

打開舊版 Little Fighter 2 的 `.dat`（角色、背景、關卡），看成文字。磁碟上的檔案維持加密，不會被寫回。

雙擊 `.dat` 可看解密後的文字。**Open in Text Editor**（或指令 **LF2: Open Data as Text**）會開到一般編輯器，可以搜尋，也有上色。那個分頁是唯讀的。

如果這個檔不是 LF2 資料，畫面會說明，並可改用原本的編輯器打開。

若不希望每個 `.dat` 都用這個方式開啟，在設定加入：

```json
"workbench.editorAssociations": {
  "*.dat": "default"
}
```
