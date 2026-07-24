(function () {
  const SESSION_KEY = 'afterpost:session:v1';

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

  function trackEvent(action, payload = {}) {
    const eventId = payload.eventId || window.resolveAfterPostEventId?.();
    if (!eventId) return;
    const body = {
      sessionId: getSessionId(),
      action,
      source: payload.source || undefined,
      templateId: payload.templateId || undefined,
      moodTag: payload.moodTag || undefined,
      momentType: payload.momentType || undefined,
      comment: payload.comment ? String(payload.comment).slice(0, 280) : undefined,
    };
    fetch(`/api/events/${encodeURIComponent(eventId)}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  window.AfterPostAnalytics = { getSessionId, trackEvent };
})();
