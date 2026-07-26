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
   * Canvas上でテキストを折り返す(app.jsと同趣旨だがコードは共有せず独立実装)。
   * @param {CanvasRenderingContext2D} context
   * @param {string} text
   * @param {number} maxWidth
   * @param {number} maxLines
   * @returns {string[]}
   */
  function wrapCanvasText(context, text, maxWidth, maxLines) {
    const lines = [];
    let current = '';
    for (const character of text) {
      if (context.measureText(current + character).width > maxWidth && current) {
        lines.push(current);
        current = character;
        if (lines.length === maxLines) break;
      } else {
        current += character;
      }
    }
    if (lines.length < maxLines && current) lines.push(current);
    if (lines.join('').length < text.length) lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, -1)}…`;
    return lines;
  }

  /**
   * 公式リアクションカード(1200x675 PNG)を生成する。ダーク基調のシンプルな1枚。
   * コメントはログAPI経由の外部入力なので、Canvas API(fillText)にのみ渡す(ADR-0004)。
   * @param {AfterPostEventConfig} config
   * @param {string} comment
   * @param {string} eventUrl
   * @returns {Promise<File>}
   */
  async function createReactionCardFile(config, comment, eventUrl) {
    await document.fonts.ready;
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 675;
    const context = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

    // 背景: ダッシュボードの--ink(#17141f)に寄せたダークグラデーション
    const background = context.createLinearGradient(0, 0, 1200, 675);
    background.addColorStop(0, '#131017');
    background.addColorStop(0.62, '#1c1626');
    background.addColorStop(1, '#2b2036');
    context.fillStyle = background;
    context.fillRect(0, 0, 1200, 675);

    // 上端のアクセントラインと細い枠線
    const accent = context.createLinearGradient(0, 0, 1200, 0);
    accent.addColorStop(0, '#69538f');
    accent.addColorStop(0.55, '#ef7049');
    accent.addColorStop(1, '#d2a24f');
    context.fillStyle = accent;
    context.fillRect(0, 0, 1200, 6);
    context.strokeStyle = 'rgba(255,255,255,.16)';
    context.lineWidth = 1;
    context.strokeRect(40.5, 44.5, 1119, 586);

    // ヘッダー: ラベル + イベント名 + 開催情報
    context.fillStyle = '#d2a24f';
    context.font = '800 14px "Noto Sans JP", sans-serif';
    context.fillText('O F F I C I A L   R E A C T I O N', 80, 106);
    context.fillStyle = '#fff';
    context.font = '800 31px "Noto Sans JP", sans-serif';
    context.fillText(config.eventName, 80, 152);
    context.fillStyle = 'rgba(255,255,255,.64)';
    context.font = '500 16px "Noto Sans JP", sans-serif';
    const metaParts = [config.eventSubTitle, config.date, config.venue].filter((part) => part);
    context.fillText(metaParts.join(' / '), 80, 185);

    // 引用コメント
    context.fillStyle = '#fff';
    context.font = '700 45px "Noto Sans JP", sans-serif';
    const quoteLines = wrapCanvasText(context, `「${comment}」`, 1000, 4);
    quoteLines.forEach((line, index) => context.fillText(line, 96, 288 + index * 64));

    // フッター: ハッシュタグ + ブランド + イベントURL
    context.fillStyle = '#d2a24f';
    context.font = '700 21px "Noto Sans JP", sans-serif';
    context.fillText(config.hashtags.join(' '), 80, 556);
    context.fillStyle = '#fff';
    context.font = '800 13px "Noto Sans JP", sans-serif';
    context.fillText('AFTER POST', 80, 594);
    const brandWidth = context.measureText('AFTER POST').width;
    context.fillStyle = 'rgba(255,255,255,.78)';
    context.font = '500 13px "Noto Sans JP", sans-serif';
    context.fillText(eventUrl, 80 + brandWidth + 14, 594);

    const blob = await /** @type {Promise<Blob>} */ (new Promise((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('PNG generation failed')), 'image/png');
    }));
    return new File([blob], `${config.eventId}-reaction-card.png`, { type: 'image/png' });
  }

  /** @param {File} file */
  function downloadFile(file) {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** @param {string} message */
  function showCommentShareNote(message) {
    const note = query('#commentShareNote');
    note.textContent = message;
    note.classList.remove('hidden');
  }

  /**
   * 感想コメントをリアクションカードにして共有する。Web Share API(ファイル添付)が
   * 使える環境ではOSの共有シートを開き、非対応環境ではPNG保存 + X intentにフォールバックする。
   * @param {AfterPostEventConfig} config
   * @param {string} comment
   * @param {HTMLButtonElement} button
   */
  async function shareCommentCard(config, comment, button) {
    const eventUrl = `${window.location.origin}/e/${config.eventId}/?src=card`;
    const shareText = `${config.eventName} ${config.eventSubTitle}に届いた感想です。\n\n「${comment}」\n\n${config.hashtags.join(' ')}\n${eventUrl}`;
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = 'カードを作成中…';
    try {
      const file = await createReactionCardFile(config, comment, eventUrl);
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `${config.eventName} ${config.eventSubTitle}`, text: shareText, files: [file] });
        showCommentShareNote('共有先を選んで投稿してください。');
      } else {
        downloadFile(file);
        window.open(`https://x.com/intent/post?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
        showCommentShareNote('カード画像を保存しました。Xの投稿画面で添付してください。');
      }
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'AbortError') {
        showCommentShareNote('カードを作成できませんでした。もう一度お試しください。');
      }
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
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

    /** @type {[string, number][]} */
    const sourceItems = [
      ['QRコード', stats.sourceBreakdown.qr],
      ['シェアカード', stats.sourceBreakdown.card],
      ['直接アクセス', stats.sourceBreakdown.direct],
      ['その他', stats.sourceBreakdown.other],
    ];
    const maxSource = Math.max(1, ...sourceItems.map((item) => item[1]));
    const sourceBreakdown = query('#sourceBreakdown');
    sourceItems.forEach(([label, value], index) => {
      const row = document.createElement('div');
      row.className = 'source-row';
      const labelSpan = document.createElement('span');
      labelSpan.textContent = label;
      const barWrap = document.createElement('div');
      const bar = document.createElement('i');
      bar.style.width = value ? `${Math.max(2, (value / maxSource) * 100)}%` : '0';
      barWrap.appendChild(bar);
      const valueBold = document.createElement('b');
      valueBold.textContent = value.toLocaleString('ja-JP');
      row.append(labelSpan, barWrap, valueBold);
      row.style.setProperty('--delay', `${index * 70}ms`);
      sourceBreakdown.appendChild(row);
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
      const bodyDiv = document.createElement('div');
      const textParagraph = document.createElement('p');
      textParagraph.textContent = `「${comment}」`;
      const shareButton = document.createElement('button');
      shareButton.type = 'button';
      shareButton.className = 'comment-share-button';
      shareButton.textContent = 'この感想をカードにする';
      shareButton.addEventListener('click', () => shareCommentCard(eventConfig, comment, shareButton));
      bodyDiv.append(textParagraph, shareButton);
      blockquote.append(numberSpan, bodyDiv);
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
