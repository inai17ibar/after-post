/**
 * コメントのモデレーション（NGワード伏字化・不可視文字の検出/除去）。
 *
 * 方針:
 * - NGワードは「拒否」ではなく「伏字化」する。ファンの投稿全体を捨てず、
 *   該当語のみを同じ文字数の「＊」に置き換えて保存する。
 * - 制御文字（改行・タブ以外のC0/C1）は入口の検証(validation.ts)で拒否する。
 * - ゼロ幅文字はNGワード検出の回避や見た目の改ざんに使われるため、
 *   照合の前に除去する（検出用の関数も別途エクスポートする）。
 */

// --- NGワードリスト ---------------------------------------------------------
// 保守メモ:
// - カテゴリごとの配列に追記する。英語の語はすべて小文字で書く。
// - 英数字のみの語は単語境界(\b)つき・大文字小文字無視で照合される
//   （例: "dick" は "Dickens" にはマッチしない）。
// - 日本語の語は部分一致で照合されるため、日常語に含まれる文字列を
//   登録すると誤爆する（例: 「クソ」は「クソ暑い」等の口語で誤爆しやすい
//   ため初期リストには入れていない）。追加時は誤爆の可能性を必ず確認する。

// 暴力・脅迫系
const VIOLENCE_WORDS = [
  '死ね',
  'しね',
  '殺す',
  'ころす',
  '殺すぞ',
  '殺せ',
  'kill yourself',
  'kys',
];

// 差別・侮蔑系
const DISCRIMINATION_WORDS = [
  'キチガイ',
  'きちがい',
  'ガイジ',
  '池沼',
  'チョン',
  '土人',
  'nigger',
  'nigga',
  'faggot',
  'retard',
];

// わいせつ系
const OBSCENITY_WORDS = [
  'レイプ',
  '強姦',
  'セックス',
  'ちんこ',
  'ちんぽ',
  'まんこ',
  'オナニー',
  'fuck',
  'cunt',
  'blowjob',
  'pussy',
];

export const NG_WORDS: readonly string[] = [
  ...VIOLENCE_WORDS,
  ...DISCRIMINATION_WORDS,
  ...OBSCENITY_WORDS,
];

// --- 不可視文字（制御文字・ゼロ幅文字） -------------------------------------

// 改行(\n)・復帰(\r)・タブ(\t)を除く C0 制御文字、DEL(U+007F)、C1 制御文字
const CONTROL_CHARS_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

// ゼロ幅文字類: ZWSP(U+200B)〜ZWJ(U+200D)、WORD JOINER(U+2060)、BOM/ZWNBSP(U+FEFF)
const ZERO_WIDTH_CHARS_PATTERN = /[\u200B-\u200D\u2060\uFEFF]/;

/** 改行・タブ以外の制御文字(C0/C1)を含むかどうか */
export function containsControlChars(value: string): boolean {
  return CONTROL_CHARS_PATTERN.test(value);
}

/** ゼロ幅文字（ZWSP/ZWNJ/ZWJ/WORD JOINER/BOM）を含むかどうか */
export function containsZeroWidthChars(value: string): boolean {
  return ZERO_WIDTH_CHARS_PATTERN.test(value);
}

/** ゼロ幅文字を除去した文字列を返す */
export function stripZeroWidthChars(value: string): string {
  return value.replace(new RegExp(ZERO_WIDTH_CHARS_PATTERN.source, 'g'), '');
}

// --- NGワード照合 -----------------------------------------------------------

const ASCII_PRINTABLE_PATTERN = /^[\x20-\x7E]+$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const NG_WORD_PATTERNS: readonly RegExp[] = NG_WORDS.map((word) =>
  ASCII_PRINTABLE_PATTERN.test(word)
    ? new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gi')
    : new RegExp(escapeRegExp(word), 'g'),
);

export interface ModerationResult {
  /** ゼロ幅文字除去・NGワード伏字化済みのコメント */
  comment: string;
  /** NGワードを1語以上伏字化したかどうか */
  masked: boolean;
}

/**
 * コメントをモデレーションする純関数。
 * ゼロ幅文字を除去したうえで、NGワードを同じ文字数の「＊」に置き換える。
 */
export function moderateComment(comment: string): ModerationResult {
  let result = stripZeroWidthChars(comment);
  let masked = false;
  for (const pattern of NG_WORD_PATTERNS) {
    result = result.replace(pattern, (match) => {
      masked = true;
      return '＊'.repeat(match.length);
    });
  }
  return { comment: result, masked };
}
