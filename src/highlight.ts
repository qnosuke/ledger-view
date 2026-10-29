import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { TokenSpan, tokenizeDoc } from "./tokenizer";

const markCache = new Map<string, Decoration>();

function mark(cls: string): Decoration {
  let d = markCache.get(cls);
  if (!d) {
    d = Decoration.mark({ class: cls });
    markCache.set(cls, d);
  }
  return d;
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  let off = 0;
  const lines: { from: number; text: string }[] = [];
  for (const text of view.state.doc.iterLines()) {
    lines.push({ from: off, text });
    off += text.length + 1;
  }
  const spans: TokenSpan[] = tokenizeDoc(lines);
  for (const s of spans) {
    builder.add(s.from, s.to, mark(s.cls));
  }
  return builder.finish();
}

/**
 * Re-highlights the whole document whenever it changes. Ledger journals are
 * small enough that a full re-tokenization per keystroke is imperceptible.
 */
export const ledgerHighlight = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
