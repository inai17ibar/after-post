(function () {
  const demoEvent = {
    eventId: 'afterglow-2026-tokyo-day1',
    eventName: 'AFTER GLOW 2026',
    eventSubTitle: 'TOKYO DAY1',
    venue: 'TOKYO ARENA',
    date: '2026.07.12',
    themeId: 'violet-glow',
    hashtags: ['#AFTERGLOW2026', '#AFTERPOST', '#今日の余韻'],
    campaignText: 'カードを保存・投稿した方の中から抽選で、AFTER GLOW限定メモリアルカードをプレゼント。',
    leadCopy: '今日の余韻を、限定カードに。',
    description: 'まとまっていない言葉でも大丈夫。今夜だけのシェアカードをつくって、Xへ届けよう。',
    moments: ['曲', 'MC', '演出', '衣装', '推し', '会場の空気', 'アンコール'],
    moodTags: ['胸がいっぱい', '泣いた', '最高', 'まだ浸ってる', '語りたい', '元気をもらった', '推しが尊い'],
    templates: [
      { templateId: 'standard-glow', name: 'Standard Glow', description: '紫から青へ、光の余韻を残す定番カード。', unlock: 'default' },
      { templateId: 'tokyo-day1-limited', name: 'Tokyo Day1 Limited', description: '会場と日付を刻んだ、DAY1だけの限定デザイン。', unlock: 'qr' },
      { templateId: 'after-encore', name: 'After Encore', description: 'カード生成後に現れる、深夜のアンコールカラー。', unlock: 'generated' },
    ],
  };

  const events = { [demoEvent.eventId]: demoEvent };

  function resolveEventId(pathname = window.location.pathname) {
    const match = pathname.match(/\/e\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : demoEvent.eventId;
  }

  window.AFTER_POST_EVENTS = events;
  window.AFTER_POST_DEMO_EVENT = demoEvent;
  window.getAfterPostEvent = (eventId = resolveEventId()) => events[eventId] || null;
  window.resolveAfterPostEventId = resolveEventId;
})();
