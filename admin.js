(function () {
  /**
   * HTMLシェルに必ず存在する要素を取得する(型検査用の薄いラッパー。実行時チェックはしない)。
   * @param {string} selector
   * @returns {HTMLElement}
   */
  function query(selector) {
    return /** @type {HTMLElement} */ (document.querySelector(selector));
  }

  const statusOverlay = query('#statusOverlay');
  const statusMessage = query('#statusMessage');
  const statusRetry = query('#statusRetry');

  /**
   * @param {string} message
   * @param {{ retry?: boolean }} [options]
   */
  function showStatus(message, { retry = false } = {}) {
    statusMessage.textContent = message;
    statusRetry.classList.toggle('hidden', !retry);
    statusOverlay.classList.remove('hidden');
  }

  function hideStatus() {
    statusOverlay.classList.add('hidden');
  }

  /**
   * 集計値からダッシュボード全体を描画する。ランキングのラベル(moodTag/momentType)は
   * ログAPI経由で誰でも送れる値なので、必ずtextContent/DOM APIで挿入する(ADR-0004)。
   * @param {AfterPostEventConfig} eventConfig
   * @param {AfterPostDashboardStats} stats
   */
  function renderDashboard(eventConfig, stats) {
    /** @type {HTMLAnchorElement} */ (query('#fanLink')).href = `/e/${eventConfig.eventId}/`;
    query('#eventTitle').textContent = `${eventConfig.eventName} ${eventConfig.eventSubTitle}`;
    query('#eventMeta').textContent = `${eventConfig.date} / ${eventConfig.venue}`;
    query('#liveLogCount').textContent = String(stats.liveLogCount);

    /** @type {[string, number, string][]} */
    const metrics = [
      ['QRアクセス', stats.qrViews, 'QR PAGE VIEW'],
      ['全ページビュー', stats.pageViews, 'ALL PAGE VIEW'],
      ['カード作成開始', stats.starts, 'STARTED'],
      ['カード生成完了', stats.generated, 'GENERATED'],
      ['画像保存', stats.saved, 'SAVED'],
      ['X共有クリック', stats.shared, 'SHARED'],
    ];

    const metricGrid = query('#metricGrid');
    metrics.forEach(([label, value, hint]) => {
      const card = document.createElement('article');
      card.className = 'metric-card';
      const hintSpan = document.createElement('span');
      hintSpan.textContent = hint;
      const valueStrong = document.createElement('strong');
      valueStrong.textContent = value.toLocaleString('ja-JP');
      const labelParagraph = document.createElement('p');
      labelParagraph.textContent = label;
      card.append(hintSpan, valueStrong, labelParagraph);
      metricGrid.appendChild(card);
    });

    /** @type {[string, number][]} */
    const funnelItems = [
      ['QRアクセス', stats.qrViews],
      ['作成開始', stats.starts],
      ['カード生成', stats.generated],
      ['画像保存', stats.saved],
      ['X共有', stats.shared],
    ];
    const maxFunnel = Math.max(...funnelItems.map((item) => item[1]));
    const funnel = query('#funnel');
    funnelItems.forEach(([label, value], index) => {
      const row = document.createElement('div');
      row.className = 'funnel-row';
      const labelSpan = document.createElement('span');
      labelSpan.textContent = label;
      const barWrap = document.createElement('div');
      const bar = document.createElement('i');
      bar.style.width = `${Math.max(8, (value / maxFunnel) * 100)}%`;
      barWrap.appendChild(bar);
      const valueBold = document.createElement('b');
      valueBold.textContent = String(value);
      row.append(labelSpan, barWrap, valueBold);
      row.style.setProperty('--delay', `${index * 70}ms`);
      funnel.appendChild(row);
    });

    /**
     * @param {string} id
     * @param {number} value
     */
    function setRing(id, value) {
      query(id).style.setProperty('--rate', `${Math.min(100, value) * 3.6}deg`);
    }
    query('#completionRate').textContent = `${stats.completionRate.toFixed(1)}%`;
    query('#shareRate').textContent = `${stats.shareRate.toFixed(1)}%`;
    setRing('#completionRing', stats.completionRate);
    setRing('#shareRing', stats.shareRate);

    /**
     * @param {string} selector
     * @param {[string, number][]} entries
     */
    function renderRanking(selector, entries) {
      const container = query(selector);
      const max = entries[0]?.[1] || 1;
      entries.slice(0, 7).forEach(([label, count], index) => {
        const row = document.createElement('div');
        row.className = 'rank-row';
        const rankBold = document.createElement('b');
        rankBold.textContent = String(index + 1).padStart(2, '0');
        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;
        const barWrap = document.createElement('div');
        const bar = document.createElement('i');
        bar.style.width = `${(count / max) * 100}%`;
        barWrap.appendChild(bar);
        const countEm = document.createElement('em');
        countEm.textContent = String(count);
        row.append(rankBold, labelSpan, barWrap, countEm);
        container.appendChild(row);
      });
    }
    renderRanking('#moodRanking', stats.moods);
    renderRanking('#momentRanking', stats.moments);

    const wordCloud = query('#wordCloud');
    stats.words.forEach(([word, count], index) => {
      const chip = document.createElement('span');
      chip.textContent = word;
      chip.style.fontSize = `${Math.max(12, 21 - index)}px`;
      chip.title = `${count}件`;
      wordCloud.appendChild(chip);
    });

    const comments = query('#comments');
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
    query('#qrEventName').textContent = eventConfig.eventName;
    query('#qrSubtitle').textContent = eventConfig.eventSubTitle;
    query('#qrLead').textContent = eventConfig.leadCopy;
    query('#qrHashtags').textContent = eventConfig.hashtags.slice(0, 2).join('  ');
    query('#qrUrl').textContent = qrTarget;
    /** @type {HTMLImageElement} */ (query('#qrImage')).src = '/assets/afterglow-qr.svg';
    query('#printQr').addEventListener('click', () => window.print());
  }

  async function init() {
    showStatus('読み込み中…');

    const params = window.resolveAfterPostAdminParams();
    if (!params) {
      showStatus('この管理用リンクは無効です。URLをご確認ください。');
      return;
    }

    /** @type {AfterPostEventConfig | null} */
    let eventConfig = null;
    /** @type {AfterPostDashboardResult | null} */
    let dashboardResult = null;
    try {
      [eventConfig, dashboardResult] = await Promise.all([
        window.fetchAfterPostEvent(params.eventId),
        window.fetchAfterPostDashboard(params.eventId, params.adminToken),
      ]);
    } catch (error) {
      showStatus('通信エラーが発生しました。もう一度お試しください。', { retry: true });
      return;
    }

    if (!eventConfig || !dashboardResult || dashboardResult.error === 'not_found') {
      showStatus('このイベントは見つかりませんでした。');
      return;
    }

    if (dashboardResult.error) { // not_foundは上で処理済みなので、残るのはforbiddenのみ
      showStatus('この管理用リンクは無効です。運営者にご確認ください。');
      return;
    }

    renderDashboard(eventConfig, dashboardResult.stats);
    hideStatus();
  }

  statusRetry.addEventListener('click', init);

  init();
})();
