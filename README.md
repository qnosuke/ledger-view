# Ledger Viewer for Obsidian

Open and edit [Ledger CLI](https://www.ledger-cli.org/) plain-text accounting files (`.ledger`) directly inside Obsidian, with VSCode-style syntax highlighting.

Syntax rules are ported from the VSCode extension **[vscode-ledger](https://github.com/mariosangiorgio/vscode-ledger)** (MIT License), and the color palette follows VSCode's default **Dark+ / Light+** themes. Highlighting automatically follows Obsidian's dark/light theme.

## Features

- Open `.ledger` / `.ldg` / `.ldgr` / `.journal` / `.hledger` files with a click
- CodeMirror 6 based editing (undo/redo, line numbers, multiple cursors, line wrapping)
- Same color rules as the VSCode ledger extension (see the table below)
- Auto save (0.8s after typing stops / on focus loss / `Cmd/Ctrl+S`)
- Read-only toggle (button in the header)
- Automatic reload on external changes (e.g. sync tools) when there are no unsaved edits
- Works on desktop and mobile

## Install

Once approved, install from Obsidian's Community Plugins browser ("Ledger Viewer").

Manual install (before approval / from source):

1. Copy `main.js`, `manifest.json`, and `styles.css` into
   `.obsidian/plugins/ledger-view/` inside your vault
2. Disable Restricted Mode in Settings → Community Plugins (if you haven't)
3. Enable "Ledger Viewer"

## Highlighting reference

| Element | Example | TextMate scope | Dark+ | Light+ |
|---|---|---|---|---|
| Date | `2024/04/01` | `string.other.date` | `#CE9178` | `#A31515` |
| Effective date | `=2024/05/02` | same | same | same |
| Amount | `3,480` `-100,000` | `constant.numeric.amount` | `#B5CEA8` | `#098658` |
| Currency | `JPY` `USD` `¥` | `constant.other.currency` | default | default |
| Account (posting) | `Assets:Cash` | `markup.bold.account` | **bold** | **bold** |
| Virtual posting | `(Assets:Cash)` | `markup.italic.account` | *italic* | *italic* |
| Directive | `account` `commodity` `include` `Y` `P` | `keyword` | `#569CD6` | `#0000FF` |
| `payee` directive | `payee store` | `keyword.control` | `#C586C0` | `#AF00DB` |
| Identifier args | value of `alias`, path of `include` | `variable.other` | `#9CDCFE` | `#001080` |
| Expression | `= Expenses:Food > 10000`, `assert`/`check`/`eval` | `string.regexp` | `#D16969` | `#811F3F` |
| Cleared description | `* description` | `markup.italic.desc` | *italic* | *italic* |
| Pending description | `! description` | `markup.underline.desc` | <u>underline</u> | <u>underline</u> |
| Comment | `;` `#` `%` `\|` `*` at line start / `comment` block | `comment` | `#6A9955` | `#008000` |

Note: one deliberate improvement over VSCode — for lines like `account X ; comment`,
VSCode drops the whole line's coloring, while this plugin keeps the keyword and account
colors and only colors the trailing comment green.

## Development

```sh
npm install
npm run build   # type-check + build main.js
npm test        # tokenizer tests (sample.ledger)
```

## Credits

- Syntax grammar: [mariosangiorgio/vscode-ledger](https://github.com/mariosangiorgio/vscode-ledger) (MIT License)
- Color palette: Visual Studio Code default themes Dark+ / Light+

---

# Ledger Viewer for Obsidian（日本語）

[Ledger CLI](https://www.ledger-cli.org/) のファイル（`.ledger` など）を Obsidian 内で開けるようにするプラグインです。
シンタックスハイライトは VSCode 拡張 **[vscode-ledger](https://github.com/mariosangiorgio/vscode-ledger)** (MIT) の TextMate 文法を移植し、配色は VSCode 標準テーマ (**Dark+ / Light+**) に合わせています。Obsidian のテーマ（ダーク/ライト）に応じて自動で切り替わります。

## 機能

- `.ledger` / `.ldg` / `.ldgr` / `.journal` / `.hledger` ファイルをクリックで開く
- CodeMirror 6 ベースの編集（元に戻す/やり直し、行番号、複数選択、行折り返し）
- VSCode ledger 拡張と同じ色分け規則（上記英語セクションの対応表参照）
- 自動保存（入力停止後 0.8 秒 / フォーカス喪失時 / `Cmd/Ctrl+S`）
- 読み取り専用トグル（ヘッダーのボタン）
- 外部変更（同期ツールなど）を自動で再読み込み（未保存変更がない場合）

## 開発

```sh
npm install
npm run build   # 型チェック + main.js ビルド
npm test        # トークナイザーのテスト(sample.ledger)
```

## クレジット

- シンタックス文法: [mariosangiorgio/vscode-ledger](https://github.com/mariosangiorgio/vscode-ledger) (MIT License)
- 配色: Visual Studio Code 標準テーマ Dark+ / Light+
