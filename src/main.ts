import { Plugin } from "obsidian";
import { LEDGER_EXTENSIONS, LedgerView, VIEW_TYPE_LEDGER } from "./view";

export default class LedgerPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerView(VIEW_TYPE_LEDGER, (leaf) => new LedgerView(leaf));
    this.registerExtensions(LEDGER_EXTENSIONS, VIEW_TYPE_LEDGER);
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_LEDGER);
  }
}
