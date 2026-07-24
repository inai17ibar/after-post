const statusOverlay = document.querySelector('#statusOverlay');
const statusMessage = document.querySelector('#statusMessage');
const statusRetry = document.querySelector('#statusRetry');

function showStatus(message, { retry = false } = {}) {
  statusMessage.textContent = message;
  statusRetry.classList.toggle('hidden', !retry);
  statusOverlay.classList.remove('hidden');
}

function hideStatus() {
  statusOverlay.classList.add('hidden');
}

function renderDashboard(eventConfig, stats) {
  document.querySelector('#fanLink').href = `/e/${eventConfig.eventId}/`;
  document.querySelector('#eventTitle').textContent = `${eventConfig.eventName} ${eventConfig.eventSubTitle}`;
  document.querySelector('#eventMeta').textContent = `${eventConfig.date} / ${eventConfig.venue}`;
  document.querySelector('#liveLogCount').textContent = stats.liveLogCount;

  const metrics = [
    ['QRアクセス', stats.qrViews, 'QR PAGE VIEW'],
    ['全ページビュー', stats.pageViews, 'ALL PAGE VIEW'],
    ['カード作成開始', stats.starts, 'STARTED'],
    ['カード生成完了', stats.generated, 'GENERATED'],
    ['画像保存', stats.saved, 'SAVED'],
    ['X共有クリック', stats.shared, 'SHARED'],
  ];

  const metricGrid = document.querySelector('#metricGrid');
  metrics.forEach(([label, value, hint]) => {
    const card = document.createElement('article');
    card.className = 'metric-card';
    card.innerHTML = `<span>${hint}</span><strong>${value.toLocaleString('ja-JP')}</strong><p>${label}</p>`;
    metricGrid.appendChild(card);
  });

  const funnelItems = [
    ['QRアクセス', stats.qrViews],
    ['作成開始', stats.starts],
    ['カード生成', stats.generated],
    ['画像保存', stats.saved],
    ['X共有', stats.shared],
  ];
  const maxFunnel = Math.max(...funnelItems.map((item) => item[1]));
  const funnel = document.querySelector('#funnel');
  funnelItems.forEach(([label, value], index) => {
    const row = document.createElement('div');
    row.className = 'funnel-row';
    row.innerHTML = `<span>${label}</span><div><i style="width:${Math.max(8, (value / maxFunnel) * 100)}%"></i></div><b>${value}</b>`;
    row.style.setProperty('--delay', `${index * 70}ms`);
    funnel.appendChild(row);
  });

  function setRing(id, value) {
    const ring = document.querySelector(id);
    ring.style.setProperty('--rate', `${Math.min(100, value) * 3.6}deg`);
  }
  document.querySelector('#completionRate').textContent = `${stats.completionRate.toFixed(1)}%`;
  document.querySelector('#shareRate').textContent = `${stats.shareRate.toFixed(1)}%`;
  setRing('#completionRing', stats.completionRate);
  setRing('#shareRing', stats.shareRate);

  function renderRanking(selector, entries) {
    const container = document.querySelector(selector);
    const max = entries[0]?.[1] || 1;
    entries.slice(0, 7).forEach(([label, count], index) => {
      const row = document.createElement('div');
      row.className = 'rank-row';
      row.innerHTML = `<b>${String(index + 1).padStart(2, '0')}</b><span>${label}</span><div><i style="width:${(count / max) * 100}%"></i></div><em>${count}</em>`;
      container.appendChild(row);
    });
  }
  renderRanking('#moodRanking', stats.moods);
  renderRanking('#momentRanking', stats.moments);

  const wordCloud = document.querySelector('#wordCloud');
  stats.words.forEach(([word, count], index) => {
    const chip = document.createElement('span');
    chip.textContent = word;
    chip.style.fontSize = `${Math.max(12, 21 - index)}px`;
    chip.title = `${count}件`;
    wordCloud.appendChild(chip);
  });

  const comments = document.querySelector('#comments');
  stats.comments.slice(0, 3).forEach((comment, index) => {
    const blockquote = document.createElement('blockquote');
    const numberSpan = document.createElement('span');
    numberSpan.textContent = `0${index + 1}`;
    const textParagraph = document.createElement('p');
    textParagraph.textContent = `「${comment}」`;
    blockquote.append(numberSpan, textParagraph);
    comments.appendChild(blockquote);
  });

  const qrTarget = `${window.location.origin}/e/${eventConfig.eventId}/?src=qr`;
  document.querySelector('#qrEventName').textContent = eventConfig.eventName;
  document.querySelector('#qrSubtitle').textContent = eventConfig.eventSubTitle;
  document.querySelector('#qrLead').textContent = eventConfig.leadCopy;
  document.querySelector('#qrHashtags').textContent = eventConfig.hashtags.slice(0, 2).join('  ');
  document.querySelector('#qrUrl').textContent = qrTarget;
  document.querySelector('#qrImage').src = '/assets/afterglow-qr.svg';
  document.querySelector('#printQr').addEventListener('click', () => window.print());
}

async function init() {
  showStatus('読み込み中…');

  const params = window.resolveAfterPostAdminParams();
  if (!params) {
    showStatus('この管理用リンクは無効です。URLをご確認ください。');
    return;
  }

  let eventConfig;
  let dashboardResult;
  try {
    [eventConfig, dashboardResult] = await Promise.all([
      window.fetchAfterPostEvent(params.eventId),
      window.fetchAfterPostDashboard(params.eventId, params.adminToken),
    ]);
  } catch (error) {
    showStatus('通信エラーが発生しました。もう一度お試しください。', { retry: true });
    return;
  }

  if (!eventConfig || dashboardResult.error === 'not_found') {
    showStatus('このイベントは見つかりませんでした。');
    return;
  }

  if (dashboardResult.error === 'forbidden') {
    showStatus('この管理用リンクは無効です。運営者にご確認ください。');
    return;
  }

  renderDashboard(eventConfig, dashboardResult.stats);
  hideStatus();
}

statusRetry.addEventListener('click', init);

init();
