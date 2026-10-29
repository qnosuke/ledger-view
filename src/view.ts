import { EventRef, FileView, Notice, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import { Compartment, EditorState } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentLess,
  indentMore,
} from "@codemirror/commands";
import { ledgerHighlight } from "./highlight";

export const VIEW_TYPE_LEDGER = "ledger-view";
export const LEDGER_EXTENSIONS = ["ledger", "ldg", "ldgr", "journal", "hledger"];

const AUTOSAVE_DELAY_MS = 800;

export class LedgerView extends FileView {
  private editor: EditorView | null = null;
  private editorHost: HTMLElement | null = null;
  private saveTimer: number | null = null;
  private dirty = false;
  private readOnly = false;
  private applyingExternal = false;
  private readOnlyComp = new Compartment();
  private modifyRef: EventRef | null = null;
  private roBtn: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_LEDGER;
  }

  getIcon(): string {
    return "receipt";
  }

  canAcceptExtension(ext: string): boolean {
    return LEDGER_EXTENSIONS.includes(ext.toLowerCase());
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass("obsidian-ledger-view");
    this.addAction("save", "保存", () => void this.saveNow());
    this.roBtn = this.addAction("pencil-line", "読み取り専用の切替", () =>
      this.toggleReadOnly()
    );
  }

  async onLoadFile(file: TFile): Promise<void> {
    await this.teardownEditor();

    this.editorHost = this.contentEl.createDiv({ cls: "olv-editor" });
    let content = "";
    try {
      content = await this.app.vault.read(file);
    } catch (err) {
      console.error("ledger-view: failed to read file", err);
      new Notice(`ファイルを読み込めませんでした: ${file.path}`);
    }

    this.dirty = false;
    this.editor = new EditorView({
      parent: this.editorHost,
      state: this.buildState(content),
    });

    this.registerModifyHook();
  }

  async onUnloadFile(): Promise<void> {
    await this.saveNow();
    await this.teardownEditor();
  }

  async onClose(): Promise<void> {
    await this.saveNow();
    await this.teardownEditor();
  }

  // ------------------------------------------------------------------ private

  private buildState(doc: string): EditorState {
    return EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        drawSelection(),
        EditorView.lineWrapping,
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          {
            key: "Mod-s",
            preventDefault: true,
            run: () => {
              void this.saveNow();
              return true;
            },
          },
          {
            key: "Tab",
            run: (v) => {
              const sel = v.state.selection.main;
              if (sel.empty) {
                v.dispatch(v.state.replaceSelection("    "));
                return true;
              }
              return indentMore(v);
            },
          },
          { key: "Shift-Tab", run: indentLess },
        ]),
        ledgerHighlight,
        this.readOnlyComp.of(EditorState.readOnly.of(this.readOnly)),
        EditorView.updateListener.of((u) => {
          if (u.docChanged && !this.applyingExternal) {
            this.dirty = true;
            this.scheduleSave();
          } else if (u.focusChanged && !u.view.hasFocus) {
            void this.saveNow();
          }
        }),
      ],
    });
  }

  private async teardownEditor(): Promise<void> {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.unregisterModifyHook();
    this.editor?.destroy();
    this.editor = null;
    this.editorHost?.remove();
    this.editorHost = null;
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.saveNow();
    }, AUTOSAVE_DELAY_MS);
  }

  private async saveNow(): Promise<void> {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const file = this.file;
    if (!this.dirty || !file || !this.editor) return;
    const content = this.editor.state.doc.toString();
    this.dirty = false;
    try {
      await this.app.vault.process(file, () => content);
    } catch (err) {
      this.dirty = true;
      console.error("ledger-view: save failed", err);
      new Notice(`保存に失敗しました: ${file.path}`);
    }
  }

  private toggleReadOnly(): void {
    this.readOnly = !this.readOnly;
    if (this.editor) {
      this.editor.dispatch({
        effects: this.readOnlyComp.reconfigure(
          EditorState.readOnly.of(this.readOnly)
        ),
      });
    }
    if (this.roBtn) {
      setIcon(this.roBtn, this.readOnly ? "lock" : "pencil-line");
    }
    new Notice(this.readOnly ? "読み取り専用: オン" : "読み取り専用: オフ");
  }

  private registerModifyHook(): void {
    this.unregisterModifyHook();
    const ref = this.app.vault.on("modify", (f) => {
      if (f !== this.file || !this.editor || this.dirty) return;
      void this.reloadFromDisk();
    });
    this.registerEvent(ref);
    this.modifyRef = ref;
  }

  private unregisterModifyHook(): void {
    if (this.modifyRef) {
      this.app.vault.offref(this.modifyRef);
      this.modifyRef = null;
    }
  }

  /** Pull external changes (e.g. iCloud sync) into the editor when clean. */
  private async reloadFromDisk(): Promise<void> {
    const file = this.file;
    const ed = this.editor;
    if (!file || !ed) return;
    let text: string;
    try {
      text = await this.app.vault.read(file);
    } catch {
      return;
    }
    if (text === ed.state.doc.toString()) return;
    this.applyingExternal = true;
    ed.dispatch({
      changes: { from: 0, to: ed.state.doc.length, insert: text },
    });
    this.applyingExternal = false;
  }
}
