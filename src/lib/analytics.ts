// analytics.js の getDashboardStats() をサーバー側(D1)向けに移植したもの。
// ロジックの意図は元のクライアント版と同じ: ファネル件数・気分/モーメントの集計・
// コメントからの頻出語抽出。デモ用の下駄(demoSeed)は is_demo イベントにのみ加算する。

// page_view のsource別ユニークセッション数。direct はsource未記録(NULL)分を含み、
// other は qr/card/direct 以外の値をまとめたもの。
export interface SourceBreakdown {
  qr: number;
  card: number;
  direct: number;
  other: number;
}

export interface DashboardStats {
  pageViews: number;
  qrViews: number;
  starts: number;
  generated: number;
  saved: number;
  shared: number;
  completionRate: number;
  shareRate: number;
  sourceBreakdown: SourceBreakdown;
  moods: [string, number][];
  moments: [string, number][];
  words: [string, number][];
  comments: string[];
  liveLogCount: number;
}

interface DemoSeed {
  pageViews: number;
  qrViews: number;
  starts: number;
  generated: number;
  saved: number;
  shared: number;
  sources: SourceBreakdown;
  moods: Record<string, number>;
  moments: Record<string, number>;
  comments: string[];
}

const DEMO_SEED: DemoSeed = {
  pageViews: 124,
  qrViews: 124,
  starts: 68,
  generated: 52,
  saved: 31,
  shared: 18,
  // pageViews=124 / qrViews=124 (全アクセスがQR経由という下駄)と整合させる
  sources: { qr: 124, card: 0, direct: 0, other: 0 },
  moods: { '胸がいっぱい': 18, '最高': 14, '泣いた': 9, 'まだ浸ってる': 7, '推しが尊い': 4 },
  moments: { MC: 16, アンコール: 13, 推し: 10, 曲: 8, 演出: 5 },
  comments: [
    '最後のMCで完全に泣いた。今日この場所にいられてよかった。',
    'アンコールの一体感がすごくて、まだ会場にいるみたい。',
    '推しの表情が忘れられない。明日からまた頑張れる。',
  ],
};

const EMPTY_SEED: DemoSeed = {
  pageViews: 0,
  qrViews: 0,
  starts: 0,
  generated: 0,
  saved: 0,
  shared: 0,
  sources: { qr: 0, card: 0, direct: 0, other: 0 },
  moods: {},
  moments: {},
  comments: [],
};

const STOP_WORDS = new Set([
  '今日', 'この', 'その', 'まだ', 'すごく', 'だった', 'ました', 'いる', 'みたい', 'こと', '本当に', 'から', 'まで',
]);

function increment(target: Record<string, number>, key: string | null | undefined, amount = 1) {
  if (!key) return;
  target[key] = (target[key] || 0) + amount;
}

function topEntries(values: Record<string, number>): [string, number][] {
  return Object.entries(values).sort((a, b) => b[1] - a[1]);
}

function extractWords(comments: string[]): [string, number][] {
  const words: Record<string, number> = {};
  comments.forEach((comment) => {
    let candidates: string[] = [];
    if (typeof Intl !== 'undefined' && (Intl as unknown as { Segmenter?: unknown }).Segmenter) {
      const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
      candidates = [...segmenter.segment(comment)]
        .filter((item) => item.isWordLike)
        .map((item) => item.segment);
    } else {
      candidates = comment.match(/[一-龠々ぁ-んァ-ヶーA-Za-z0-9]{2,}/g) || [];
    }
    candidates.forEach((word) => {
      const normalized = word.trim();
      if (normalized.length < 2 || STOP_WORDS.has(normalized)) return;
      increment(words, normalized);
    });
  });
  return topEntries(words).slice(0, 10);
}

async function countDistinctSessions(
  db: D1Database,
  eventId: string,
  action: string,
  extraWhere = '',
  extraParams: string[] = [],
): Promise<number> {
  const stmt = db
    .prepare(`SELECT COUNT(DISTINCT session_id) as c FROM event_logs WHERE event_id = ? AND action = ? ${extraWhere}`)
    .bind(eventId, action, ...extraParams);
  const row = await stmt.first<{ c: number }>();
  return row?.c ?? 0;
}

export async function getDashboardStats(db: D1Database, eventId: string, isDemo: boolean): Promise<DashboardStats> {
  const seed = isDemo ? DEMO_SEED : EMPTY_SEED;

  const [pageViews, qrViews, cardViews, directViews, otherViews, starts, generated, saved, shared] =
    await Promise.all([
      countDistinctSessions(db, eventId, 'page_view'),
      countDistinctSessions(db, eventId, 'page_view', 'AND source = ?', ['qr']),
      countDistinctSessions(db, eventId, 'page_view', 'AND source = ?', ['card']),
      // フロントは未指定時に'direct'を送るが、source省略のログもdirect扱いに含める
      countDistinctSessions(db, eventId, 'page_view', 'AND (source = ? OR source IS NULL)', ['direct']),
      countDistinctSessions(db, eventId, 'page_view', 'AND source IS NOT NULL AND source NOT IN (?, ?, ?)', [
        'qr',
        'card',
        'direct',
      ]),
      countDistinctSessions(db, eventId, 'start_clicked'),
      countDistinctSessions(db, eventId, 'card_generated'),
      countDistinctSessions(db, eventId, 'image_saved'),
      countDistinctSessions(db, eventId, 'share_clicked'),
    ]);

  const moodRows = await db
    .prepare(
      `SELECT mood_tag as label, COUNT(*) as c FROM event_logs
       WHERE event_id = ? AND action = 'card_generated' AND mood_tag IS NOT NULL
       GROUP BY mood_tag`,
    )
    .bind(eventId)
    .all<{ label: string; c: number }>();

  const momentRows = await db
    .prepare(
      `SELECT moment_type as label, COUNT(*) as c FROM event_logs
       WHERE event_id = ? AND action = 'card_generated' AND moment_type IS NOT NULL
       GROUP BY moment_type`,
    )
    .bind(eventId)
    .all<{ label: string; c: number }>();

  const commentRows = await db
    .prepare(
      `SELECT comment FROM event_logs
       WHERE event_id = ? AND action = 'text_submitted' AND comment IS NOT NULL
       ORDER BY created_at DESC LIMIT 50`,
    )
    .bind(eventId)
    .all<{ comment: string }>();

  const liveCountRow = await db
    .prepare(`SELECT COUNT(*) as c FROM event_logs WHERE event_id = ?`)
    .bind(eventId)
    .first<{ c: number }>();

  const moods: Record<string, number> = { ...seed.moods };
  (moodRows.results ?? []).forEach((row) => increment(moods, row.label, row.c));

  const moments: Record<string, number> = { ...seed.moments };
  (momentRows.results ?? []).forEach((row) => increment(moments, row.label, row.c));

  const recentComments = (commentRows.results ?? []).map((row) => row.comment).reverse();
  const comments = [...seed.comments, ...recentComments];

  const totalStarts = seed.starts + starts;
  const totalGenerated = seed.generated + generated;
  const totalShared = seed.shared + shared;

  return {
    pageViews: seed.pageViews + pageViews,
    qrViews: seed.qrViews + qrViews,
    starts: totalStarts,
    generated: totalGenerated,
    saved: seed.saved + saved,
    shared: totalShared,
    completionRate: totalStarts ? (totalGenerated / totalStarts) * 100 : 0,
    shareRate: totalGenerated ? (totalShared / totalGenerated) * 100 : 0,
    sourceBreakdown: {
      qr: seed.sources.qr + qrViews,
      card: seed.sources.card + cardViews,
      direct: seed.sources.direct + directViews,
      other: seed.sources.other + otherViews,
    },
    moods: topEntries(moods),
    moments: topEntries(moments),
    words: extractWords(comments),
    comments: comments.slice(-5).reverse(),
    liveLogCount: liveCountRow?.c ?? 0,
  };
}
