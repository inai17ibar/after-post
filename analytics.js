(function () {
  const SESSION_KEY = 'afterpost:session:v1';
  const LOG_KEY = 'afterpost:event-logs:v1';

  const demoSeed = {
    pageViews: 124,
    qrViews: 124,
    starts: 68,
    generated: 52,
    saved: 31,
    shared: 18,
    moods: { '胸がいっぱい': 18, '最高': 14, '泣いた': 9, 'まだ浸ってる': 7, '推しが尊い': 4 },
    moments: { 'MC': 16, 'アンコール': 13, '推し': 10, '曲': 8, '演出': 5 },
    comments: [
      '最後のMCで完全に泣いた。今日この場所にいられてよかった。',
      'アンコールの一体感がすごくて、まだ会場にいるみたい。',
      '推しの表情が忘れられない。明日からまた頑張れる。',
    ],
  };

  function safeRead(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function safeWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function getSessionId() {
    let sessionId = safeRead(SESSION_KEY, '');
    if (!sessionId) {
      sessionId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      safeWrite(SESSION_KEY, sessionId);
    }
    return sessionId;
  }

  function getAllLogs() {
    const logs = safeRead(LOG_KEY, []);
    return Array.isArray(logs) ? logs : [];
  }

  function trackEvent(action, payload = {}) {
    const entry = {
      eventId: payload.eventId || window.resolveAfterPostEventId?.() || 'unknown',
      sessionId: getSessionId(),
      action,
      source: payload.source || undefined,
      templateId: payload.templateId || undefined,
      moodTag: payload.moodTag || undefined,
      momentType: payload.momentType || undefined,
      comment: payload.comment ? String(payload.comment).slice(0, 280) : undefined,
      createdAt: new Date().toISOString(),
    };
    const logs = getAllLogs();
    logs.push(entry);
    safeWrite(LOG_KEY, logs.slice(-2000));
    return entry;
  }

  function getEventLogs(eventId) {
    return getAllLogs().filter((log) => log && log.eventId === eventId);
  }

  function uniqueSessions(logs, action, predicate = () => true) {
    return new Set(logs.filter((log) => log.action === action && predicate(log)).map((log) => log.sessionId)).size;
  }

  function increment(target, key, amount = 1) {
    if (!key) return;
    target[key] = (target[key] || 0) + amount;
  }

  function topEntries(values) {
    return Object.entries(values).sort((a, b) => b[1] - a[1]);
  }

  function extractWords(comments) {
    const stopWords = new Set(['今日', 'この', 'その', 'まだ', 'すごく', 'だった', 'ました', 'いる', 'みたい', 'こと', '本当に', 'から', 'まで']);
    const words = {};
    comments.forEach((comment) => {
      let candidates = [];
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
        candidates = [...segmenter.segment(comment)].filter((item) => item.isWordLike).map((item) => item.segment);
      } else {
        candidates = comment.match(/[一-龠々ぁ-んァ-ヶーA-Za-z0-9]{2,}/g) || [];
      }
      candidates.forEach((word) => {
        const normalized = word.trim();
        if (normalized.length < 2 || stopWords.has(normalized)) return;
        increment(words, normalized);
      });
    });
    return topEntries(words).slice(0, 10);
  }

  function getDashboardStats(eventId, options = {}) {
    const includeDemoSeed = options.includeDemoSeed !== false;
    const seed = includeDemoSeed ? demoSeed : {
      pageViews: 0, qrViews: 0, starts: 0, generated: 0, saved: 0, shared: 0, moods: {}, moments: {}, comments: [],
    };
    const logs = getEventLogs(eventId);
    const generatedLogs = logs.filter((log) => log.action === 'card_generated');
    const moods = { ...seed.moods };
    const moments = { ...seed.moments };
    generatedLogs.forEach((log) => {
      increment(moods, log.moodTag);
      increment(moments, log.momentType);
    });
    const comments = [...seed.comments, ...logs.filter((log) => log.action === 'text_submitted' && log.comment).map((log) => log.comment)];
    const pageViews = seed.pageViews + uniqueSessions(logs, 'page_view');
    const qrViews = seed.qrViews + uniqueSessions(logs, 'page_view', (log) => log.source === 'qr');
    const starts = seed.starts + uniqueSessions(logs, 'start_clicked');
    const generated = seed.generated + uniqueSessions(logs, 'card_generated');
    const saved = seed.saved + uniqueSessions(logs, 'image_saved');
    const shared = seed.shared + uniqueSessions(logs, 'share_clicked');
    return {
      pageViews, qrViews, starts, generated, saved, shared,
      completionRate: starts ? (generated / starts) * 100 : 0,
      shareRate: generated ? (shared / generated) * 100 : 0,
      moods: topEntries(moods),
      moments: topEntries(moments),
      words: extractWords(comments),
      comments: comments.slice(-5).reverse(),
      liveLogCount: logs.length,
    };
  }

  window.AfterPostAnalytics = { getSessionId, trackEvent, getEventLogs, getDashboardStats };
})();
