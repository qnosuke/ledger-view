/**
 * Ledger syntax tokenizer.
 *
 * This is a line-based port of the TextMate grammar shipped with the VSCode
 * extension "vscode-ledger" (mariosangiorgio/vscode-ledger, MIT). Each TextMate
 * scope is mapped to a CSS class; colors are applied in styles.css following
 * VSCode's default Dark+ / Light+ palettes.
 *
 * Scope -> class mapping:
 *   string.other.date            -> olg-date
 *   constant.numeric.amount      -> olg-amount
 *   constant.other.currency      -> olg-currency
 *   keyword / keyword.other      -> olg-keyword
 *   keyword.control              -> olg-keyword-control
 *   variable.other               -> olg-variable
 *   string.regexp.expression     -> olg-regexp
 *   markup.bold.account          -> olg-account
 *   markup.italic.account        -> olg-account-virtual
 *   markup.italic.desc           -> olg-desc
 *   markup.underline.desc        -> olg-desc-pending
 *   comment.*                    -> olg-comment
 */

export interface TokenSpan {
  /** Absolute offset of the first character (doc coordinates). */
  from: number;
  /** Absolute offset one past the last character. */
  to: number;
  cls: string;
}

export interface LineTokenizeResult {
  spans: TokenSpan[];
  blockComment: boolean;
}

export const CLS = {
  comment: "cm-olg-comment",
  date: "cm-olg-date",
  amount: "cm-olg-amount",
  currency: "cm-olg-currency",
  keyword: "cm-olg-keyword",
  keywordControl: "cm-olg-keyword-control",
  variable: "cm-olg-variable",
  regexp: "cm-olg-regexp",
  account: "cm-olg-account",
  accountVirtual: "cm-olg-account-virtual",
  desc: "cm-olg-desc",
  descPending: "cm-olg-desc-pending",
} as const;

// ---------------------------------------------------------------------------
// Regexes — static literals only.
// Account-name body: any char except whitespace and grammar punctuation,
// optionally followed by one space (keeps single-space account words intact).
// ---------------------------------------------------------------------------

/** <date>[=<date>] \s+ (* | ! | uncleared) description */
const RE_TXN =
  /^(\d{4}[/-]\d\d?[/-]\d\d?|\d\d?[/-]\d\d?)(=(\d{4}[/-]\d\d?[/-]\d\d?|\d\d?[/-]\d\d?))?\s+((\*.*)|(!.*)|(.*))/;
/** Automated transaction: "= expr" */
const RE_AUTO = /^=\s(.*)$/;
const RE_IND_DEFAULT = /^[ \t]+(default|format|nomarket)\b/;
const RE_IND_EXPR = /^[ \t]+(assert|check|eval|payee|value)\s+(.*)$/;
const RE_IND_NOTE = /^[ \t]+(note)\s+(.*)$/;
const RE_IND_ALIAS = /^[ \t]+(alias)\s+(.*)$/;
/** Virtual posting `(Account)` */
const RE_VIRTUAL = /^[ \t]+\(((?:[^\s#%|*;()[\]] ?)+)\)/;
/** Balancing virtual posting `[Account]` */
const RE_BALANCING = /^[ \t]+\[((?:[^\s#%|*;()[\]] ?)+)\]/;
/** Posting line: indented account name */
const RE_POSTING = /^[ \t]+((?:[^\s#%|*;()[\]] ?)+)/;
const RE_PAYEE_DIR = /^([@!]?payee)\s+(.*)$/;
const RE_ACCT_DIR_STRICT =
  /^([@!]?(?:A|account|apply account|bucket))\s+((?:[^\s#%|*;()[\]] ?)+)$/;
const RE_ACCT_DIR_LOOSE =
  /^([@!]?(?:A|account|apply account|bucket))\s+((?:[^\s#%|*;()[\]] ?)+)/;
const RE_CHECK_DIR = /^([@!]?check)\s+(.*)$/;
const RE_CAPTURE_DIR =
  /^([@!]?capture)\s+((?:[^\s#%|*;()[\]] ?)+)\s+(.*)$/;
const RE_INCLUDE_DIR =
  /^([@!]?(?:apply tag|tag|end apply tag|end tag|include))\s(.*)$/;
const RE_OTHER_BOL =
  /^[@!]?(?:end (?:apply )?account|commodity|define|fixed|endfixed|year|pop)(?=\s|$)|^[@!]?[PYNDCIiOobh](?=\s)/;
const RE_BOL_COMMENT = /^[#%|*]/;
const RE_BLOCK_BEGIN = /^[@!]?(?:comment|test)(?=\s|$)/;
const RE_BLOCK_END = /^[@!]?end[ \t]+(?:comment|test)(?=\s|$)/;

// --- mid-line (unanchored) patterns, checked in TextMate list order ----------
const RE_DATE = /\d{4}[/-]\d\d?[/-]\d\d?|\d\d?[/-]\d\d?/y;
const RE_AMOUNT = /-?\d+(?:[,.]\d+)*/y;
const RE_CURRENCY_SYMBOL = /[$£¥฿¢₡₢₣₤₥₦₧₨₩₪₫€₭₮₯¤₠₰₱]/y;
const RE_ISO3 = /[A-Z]{3}/y;
/** Interval words usable anywhere ("keywords that can appear anywhere"). */
const RE_WORD =
  /\b(?:every|days?|weeks?|months?|quarters?|years?|daily|weekly|biweekly|monthly|quarterly|yearly|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|this|next|last|in|from|since|to|until)\b/iy;

const ISO_CURRENCIES = new Set([
  "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN",
  "BAM", "BBD", "BDT", "BGN", "BHD", "BIF", "BMD", "BND", "BOB", "BOV",
  "BRL", "BSD", "BTN", "BWP", "BYR", "BZD", "CAD", "CDF", "CHE", "CHF",
  "CHW", "CLF", "CLP", "CNY", "COP", "COU", "CRC", "CUC", "CUP", "CVE",
  "CZK", "DJF", "DKK", "DOP", "DZD", "EGP", "ERN", "ETB", "EUR", "FJD",
  "FKP", "GBP", "GEL", "GHS", "GIP", "GMD", "GNF", "GTQ", "GYD", "HKD",
  "HNL", "HRK", "HTG", "HUF", "IDR", "ILS", "INR", "IQD", "IRR", "ISK",
  "JMD", "JOD", "JPY", "KES", "KGS", "KHR", "KMF", "KPW", "KRW", "KWD",
  "KYD", "KZT", "LAK", "LBP", "LKR", "LRD", "LSL", "LTL", "LVL", "LYD",
  "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP", "MRO", "MUR", "MVR",
  "MWK", "MXN", "MXV", "MYR", "MZN", "NAD", "NGN", "NIO", "NOK", "NPR",
  "NZD", "OMR", "PAB", "PEN", "PGK", "PHP", "PKR", "PLN", "PYG", "QAR",
  "RON", "RSD", "RUB", "RWF", "SAR", "SBD", "SCR", "SDG", "SEK", "SGD",
  "SHP", "SLL", "SOS", "SRD", "SSP", "STD", "SVC", "SYP", "SZL", "THB",
  "TJS", "TMT", "TND", "TOP", "TRY", "TTD", "TWD", "TZS", "UAH", "UGX",
  "USD", "USN", "USS", "UYI", "UYU", "UZS", "VEF", "VND", "VUV", "WST",
  "XAF", "XAG", "XAU", "XBA", "XBB", "XBC", "XBD", "XCD", "XDR", "XFU",
  "XOF", "XPD", "XPF", "XPT", "XSU", "XTS", "XUA", "XXX", "YER", "ZAR",
  "ZMK", "ZWL",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sticky match of `re` at exactly position `i` (null unless it matches there). */
function matchAt(re: RegExp, text: string, i: number): RegExpMatchArray | null {
  re.lastIndex = i;
  const m = text.match(re);
  re.lastIndex = 0;
  return m;
}

const isUpperLetter = (c: string | undefined): boolean =>
  !!c && c >= "A" && c <= "Z";
const isWordChar = (c: string | undefined): boolean =>
  !!c && /[A-Za-z0-9_]/.test(c);
const isLetter = (c: string | undefined): boolean =>
  !!c && /[A-Za-z]/.test(c);

/**
 * Tokenize one line. `base` is the doc offset of the line's first character.
 * `inBlock` tells whether the previous line was inside a block comment.
 */
export function tokenizeLine(
  text: string,
  base: number,
  inBlock: boolean
): LineTokenizeResult {
  const spans: TokenSpan[] = [];

  const push = (from: number, to: number, cls: string): void => {
    if (to <= from) return;
    const last = spans[spans.length - 1];
    if (last && last.cls === cls && last.to === base + from) {
      last.to = base + to;
      return;
    }
    spans.push({ from: base + from, to: base + to, cls });
  };

  // --- block comment continuation ------------------------------------------
  if (inBlock) {
    const end = text.match(RE_BLOCK_END);
    if (end) {
      push(0, end[0].length, CLS.comment);
      return { spans: midScanPush(text, base, spans, end[0].length), blockComment: false };
    }
    push(0, text.length, CLS.comment);
    return { spans, blockComment: true };
  }

  // --- anchored rules (position 0), TextMate pattern order ------------------
  let m: RegExpMatchArray | null;

  // 1. Transaction header: colors the whole line via captures.
  if ((m = text.match(RE_TXN))) {
    push(0, m[1]!.length, CLS.date);
    if (m[3]) {
      // effective date sits inside group 2 ("=<date>")
      const rel = m[2]!.indexOf(m[3]);
      push(m[1]!.length + rel, m[1]!.length + rel + m[3].length, CLS.date);
    }
    const descAt = m[0]!.length - m[4]!.length;
    if (m[5] != null) {
      // cleared (*) — italic description
      push(descAt, descAt + m[5].length, CLS.desc);
    } else if (m[6] != null) {
      // pending (!) — underlined description
      push(descAt, descAt + m[6].length, CLS.descPending);
    }
    // uncleared descriptions stay unstyled, matching the grammar
    return { spans, blockComment: false };
  }

  // 2. Automated transaction.
  if ((m = text.match(RE_AUTO))) {
    const at = m[0]!.length - m[1]!.length;
    push(at, text.length, CLS.regexp);
    return { spans, blockComment: false };
  }

  // 3. `default|format|nomarket` after leading whitespace.
  if ((m = text.match(RE_IND_DEFAULT))) {
    const at = m[0]!.indexOf(m[1]!);
    push(at, at + m[1]!.length, CLS.keyword);
    return { spans: midScanPush(text, base, spans, m[0]!.length), blockComment: false };
  }

  // 4. `assert|check|eval|payee|value <expr>` after leading whitespace.
  if ((m = text.match(RE_IND_EXPR))) {
    const at = m[0]!.indexOf(m[1]!);
    push(at, at + m[1]!.length, CLS.keyword);
    const exprAt = m[0]!.length - m[2]!.length;
    push(exprAt, exprAt + m[2]!.length, CLS.regexp);
    return { spans, blockComment: false };
  }

  // 5. `note <description>`
  if ((m = text.match(RE_IND_NOTE))) {
    const at = m[0]!.indexOf(m[1]!);
    push(at, at + m[1]!.length, CLS.keyword);
    const descAt = m[0]!.length - m[2]!.length;
    push(descAt, descAt + m[2]!.length, CLS.desc);
    return { spans, blockComment: false };
  }

  // 6. `alias <name>`
  if ((m = text.match(RE_IND_ALIAS))) {
    const at = m[0]!.indexOf(m[1]!);
    push(at, at + m[1]!.length, CLS.keyword);
    const nameAt = m[0]!.length - m[2]!.length;
    push(nameAt, nameAt + m[2]!.length, CLS.variable);
    return { spans, blockComment: false };
  }

  // 7. Virtual posting `(Account)`.
  if ((m = text.match(RE_VIRTUAL))) {
    const inner = m[1]!;
    const at = m[0]!.indexOf(inner);
    push(at, at + inner.trimEnd().length, CLS.accountVirtual);
    return { spans: midScanPush(text, base, spans, m[0]!.length), blockComment: false };
  }

  // 8. Balancing virtual posting `[Account]`.
  if ((m = text.match(RE_BALANCING))) {
    const inner = m[1]!;
    const at = m[0]!.indexOf(inner);
    push(at, at + inner.trimEnd().length, CLS.accountVirtual);
    return { spans: midScanPush(text, base, spans, m[0]!.length), blockComment: false };
  }

  // 9. Posting: bold account name.
  if ((m = text.match(RE_POSTING))) {
    const acct = m[1]!;
    const at = m[0]!.indexOf(acct);
    push(at, at + acct.trimEnd().length, CLS.account);
    return { spans: midScanPush(text, base, spans, m[0]!.length), blockComment: false };
  }

  // 10. `payee <desc>` directive (keyword.control in the grammar).
  if ((m = text.match(RE_PAYEE_DIR))) {
    push(0, m[1]!.length, CLS.keywordControl);
    const descAt = m[0]!.length - m[2]!.length;
    push(descAt, text.length, CLS.desc);
    return { spans, blockComment: false };
  }

  // 11. `A|account|apply account|bucket <Account>`.
  //     The grammar anchors with `$`; we also keep colors via a loose
  //     fallback when a trailing `;` comment follows (VSCode drops them).
  if ((m = text.match(RE_ACCT_DIR_STRICT))) {
    push(0, m[1]!.length, CLS.keyword);
    const acct = m[2]!;
    const at = m[0]!.indexOf(acct, m[1]!.length);
    push(at, at + acct.trimEnd().length, CLS.account);
    return { spans, blockComment: false };
  }
  if ((m = text.match(RE_ACCT_DIR_LOOSE))) {
    push(0, m[1]!.length, CLS.keyword);
    const acct = m[2]!;
    const at = m[0]!.indexOf(acct, m[1]!.length);
    push(at, at + acct.trimEnd().length, CLS.account);
    return { spans: midScanPush(text, base, spans, m[0]!.length), blockComment: false };
  }

  // 12. `check <expr>`
  if ((m = text.match(RE_CHECK_DIR))) {
    push(0, m[1]!.length, CLS.keyword);
    const exprAt = m[0]!.length - m[2]!.length;
    push(exprAt, text.length, CLS.regexp);
    return { spans, blockComment: false };
  }

  // 13. `capture <Account> <expr>`
  if ((m = text.match(RE_CAPTURE_DIR))) {
    push(0, m[1]!.length, CLS.keyword);
    const acct = m[2]!;
    const at = m[0]!.indexOf(acct, m[1]!.length);
    push(at, at + acct.trimEnd().length, CLS.account);
    const exprAt = m[0]!.length - m[3]!.length;
    push(exprAt, text.length, CLS.regexp);
    return { spans, blockComment: false };
  }

  // 14. `apply tag|tag|end apply tag|end tag|include <arg>`
  if ((m = text.match(RE_INCLUDE_DIR))) {
    push(0, m[1]!.length, CLS.keyword);
    const argAt = m[0]!.length - m[2]!.length;
    push(argAt, text.length, CLS.variable);
    return { spans, blockComment: false };
  }

  // 15. Remaining beginning-of-line keywords.
  if ((m = text.match(RE_OTHER_BOL))) {
    push(0, m[0]!.length, CLS.keyword);
    return { spans: midScanPush(text, base, spans, m[0]!.length), blockComment: false };
  }

  // 16. Line comment starting with # % | *
  if (text.match(RE_BOL_COMMENT)) {
    push(0, text.length, CLS.comment);
    return { spans, blockComment: false };
  }

  // 17. Block comment opener (`comment` / `test`).
  if (text.match(RE_BLOCK_BEGIN)) {
    push(0, text.length, CLS.comment);
    return { spans, blockComment: true };
  }

  // Nothing anchored matched: mid-line rules scan the whole line.
  return { spans: midScanPush(text, base, spans, 0), blockComment: false };
}

/**
 * Apply the unanchored rules (dates, amounts, currencies, interval keywords,
 * `;` comments) from position `start` to end of line, pushing spans.
 */
function midScanPush(
  text: string,
  base: number,
  spans: TokenSpan[],
  start: number
): TokenSpan[] {
  const push = (from: number, to: number, cls: string): void => {
    if (to <= from) return;
    const last = spans[spans.length - 1];
    if (last && last.cls === cls && last.to === base + from) {
      last.to = base + to;
      return;
    }
    spans.push({ from: base + from, to: base + to, cls });
  };

  const n = text.length;
  let i = start;
  while (i < n) {
    const c = text[i]!;

    // `;` starts a comment running to end of line.
    if (c === ";") {
      push(i, n, CLS.comment);
      break;
    }

    let mm: RegExpMatchArray | null;

    if ((mm = matchAt(RE_DATE, text, i))) {
      push(i, i + mm[0].length, CLS.date);
      i += mm[0].length;
      continue;
    }
    if ((mm = matchAt(RE_AMOUNT, text, i))) {
      push(i, i + mm[0].length, CLS.amount);
      i += mm[0].length;
      continue;
    }
    if ((mm = matchAt(RE_CURRENCY_SYMBOL, text, i))) {
      push(i, i + mm[0].length, CLS.currency);
      i += mm[0].length;
      continue;
    }
    if (isUpperLetter(c) && (mm = matchAt(RE_ISO3, text, i))) {
      const code = mm[0];
      const prev = i > 0 ? text[i - 1] : undefined;
      const next = i + 3 < n ? text[i + 3] : undefined;
      if (ISO_CURRENCIES.has(code) && !isWordChar(prev) && !isLetter(next)) {
        push(i, i + 3, CLS.currency);
        i += 3;
        continue;
      }
    }
    if ((mm = matchAt(RE_WORD, text, i))) {
      push(i, i + mm[0].length, CLS.keyword);
      i += mm[0].length;
      continue;
    }

    i++;
  }
  return spans;
}

/**
 * Tokenize a whole document.
 *
 * @param lines iterable of `{ from, text }` line descriptors (doc offsets).
 */
export function tokenizeDoc(
  lines: Iterable<{ from: number; text: string }>
): TokenSpan[] {
  const out: TokenSpan[] = [];
  let block = false;
  for (const line of lines) {
    const r = tokenizeLine(line.text, line.from, block);
    block = r.blockComment;
    for (const s of r.spans) {
      const last = out[out.length - 1];
      // merge only within the same line (never across line breaks)
      if (
        last &&
        last.cls === s.cls &&
        last.to === s.from &&
        s.from > line.from
      ) {
        last.to = s.to;
      } else {
        out.push({ from: s.from, to: s.to, cls: s.cls });
      }
    }
  }
  return out;
}
