(function () {
  // src/lib/templates.ts の TEMPLATE_CATALOG と同じ内容(フロントはビルドしないため手動で同期する)。
  const TEMPLATE_CATALOG = [
    { templateId: 'standard-glow', name: 'Standard', description: '定番のグラデーションカード。' },
    { templateId: 'tokyo-day1-limited', name: 'Bold Accent', description: '斜めのラインが入った、目を引くデザイン。' },
    { templateId: 'after-encore', name: 'Encore Unlock', description: 'カード生成後に解放される特別カラー。' },
  ];

  /**
   * HTMLに必ず存在する要素を取得する(型検査用の薄いラッパー。実行時チェックはしない)。
   * @param {string} selector
   * @returns {HTMLElement}
   */
  function query(selector) {
    return /** @type {HTMLElement} */ (document.querySelector(selector));
  }

  /**
   * input/textareaの現在値を返す。
   * @param {string} selector
   * @returns {string}
   */
  function fieldValue(selector) {
    return /** @type {HTMLInputElement | HTMLTextAreaElement} */ (query(selector)).value;
  }

  const form = /** @type {HTMLFormElement} */ (query('#createForm'));
  const eventIdInput = /** @type {HTMLInputElement} */ (query('#eventId'));
  const eventIdPreview = query('#eventIdPreview');
  const eventIdError = query('#eventIdError');
  const formError = query('#formError');
  const submitButton = /** @type {HTMLButtonElement} */ (query('#submitButton'));
  const templateCheckboxes = query('#templateCheckboxes');
  const createResult = query('#createResult');

  TEMPLATE_CATALOG.forEach((template, index) => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'templateIds';
    checkbox.value = template.templateId;
    checkbox.checked = true;
    const text = document.createElement('span');
    text.textContent = `${template.name} — ${template.description}`;
    label.append(checkbox, text);
    templateCheckboxes.appendChild(label);
    if (index === 0) checkbox.dataset.default = 'true';
  });

  eventIdInput.addEventListener('input', () => {
    const value = eventIdInput.value.trim();
    eventIdPreview.textContent = value ? `/e/${value}/` : '/e/{イベントID}/';
    eventIdError.classList.add('hidden');
  });

  /**
   * @param {string} value
   * @param {number} max
   * @returns {string[]}
   */
  function parseCommaList(value, max) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, max);
  }

  /** @param {boolean} isLoading */
  function setLoading(isLoading) {
    submitButton.disabled = isLoading;
    submitButton.textContent = isLoading ? '作成中…' : 'イベントページをつくる';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formError.classList.add('hidden');
    eventIdError.classList.add('hidden');

    const checkedBoxes = /** @type {NodeListOf<HTMLInputElement>} */ (
      templateCheckboxes.querySelectorAll('input[name="templateIds"]:checked')
    );
    const templateIds = [...checkedBoxes].map((el) => el.value);
    if (templateIds.length === 0) {
      formError.textContent = 'テンプレートを1つ以上選んでください。';
      formError.classList.remove('hidden');
      return;
    }

    const body = {
      eventId: eventIdInput.value.trim(),
      name: fieldValue('#name').trim(),
      subtitle: fieldValue('#subtitle').trim(),
      venue: fieldValue('#venue').trim(),
      date: fieldValue('#date').trim(),
      leadCopy: fieldValue('#leadCopy').trim(),
      description: fieldValue('#description').trim(),
      campaignText: fieldValue('#campaignText').trim(),
      hashtags: parseCommaList(fieldValue('#hashtags'), 5),
      moments: parseCommaList(fieldValue('#moments'), 12),
      moodTags: parseCommaList(fieldValue('#moodTags'), 12),
      templateIds,
    };

    setLoading(true);
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.status === 409) {
        eventIdError.textContent = 'このイベントIDはすでに使われています。別のIDを指定してください。';
        eventIdError.classList.remove('hidden');
        return;
      }
      if (!response.ok) {
        formError.textContent = '入力内容を確認してください。';
        formError.classList.remove('hidden');
        return;
      }

      /** @type {{ eventId: string, publicUrl: string, adminToken: string, adminUrl: string }} */
      const result = await response.json();
      const publicUrl = new URL(result.publicUrl, window.location.origin).toString();
      const adminUrl = new URL(result.adminUrl, window.location.origin).toString();
      query('#publicUrlText').textContent = publicUrl;
      query('#adminUrlText').textContent = adminUrl;
      form.classList.add('hidden');
      createResult.classList.remove('hidden');
      createResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      formError.textContent = '通信エラーが発生しました。もう一度お試しください。';
      formError.classList.remove('hidden');
    } finally {
      setLoading(false);
    }
  });

  const copyButtons = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-copy-target]'));
  copyButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const target = query(`#${button.dataset.copyTarget}`);
      try {
        await navigator.clipboard.writeText(target.textContent ?? '');
        const original = button.textContent;
        button.textContent = 'コピーしました';
        setTimeout(() => {
          button.textContent = original;
        }, 1800);
      } catch (error) {
        // クリップボードAPIが使えない環境ではコピーボタンを無視して手動選択に委ねる
      }
    });
  });
})();
