// src/lib/templates.ts の TEMPLATE_CATALOG と同じ内容(フロントはビルドしないため手動で同期する)。
const TEMPLATE_CATALOG = [
  { templateId: 'standard-glow', name: 'Standard', description: '定番のグラデーションカード。' },
  { templateId: 'tokyo-day1-limited', name: 'Bold Accent', description: '斜めのラインが入った、目を引くデザイン。' },
  { templateId: 'after-encore', name: 'Encore Unlock', description: 'カード生成後に解放される特別カラー。' },
];

const form = document.querySelector('#createForm');
const eventIdInput = document.querySelector('#eventId');
const eventIdPreview = document.querySelector('#eventIdPreview');
const eventIdError = document.querySelector('#eventIdError');
const formError = document.querySelector('#formError');
const submitButton = document.querySelector('#submitButton');
const templateCheckboxes = document.querySelector('#templateCheckboxes');
const createResult = document.querySelector('#createResult');

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

function parseCommaList(value, max) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, max);
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? '作成中…' : 'イベントページをつくる';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.classList.add('hidden');
  eventIdError.classList.add('hidden');

  const templateIds = [...templateCheckboxes.querySelectorAll('input[name="templateIds"]:checked')].map((el) => el.value);
  if (templateIds.length === 0) {
    formError.textContent = 'テンプレートを1つ以上選んでください。';
    formError.classList.remove('hidden');
    return;
  }

  const body = {
    eventId: eventIdInput.value.trim(),
    name: document.querySelector('#name').value.trim(),
    subtitle: document.querySelector('#subtitle').value.trim(),
    venue: document.querySelector('#venue').value.trim(),
    date: document.querySelector('#date').value.trim(),
    leadCopy: document.querySelector('#leadCopy').value.trim(),
    description: document.querySelector('#description').value.trim(),
    campaignText: document.querySelector('#campaignText').value.trim(),
    hashtags: parseCommaList(document.querySelector('#hashtags').value, 5),
    moments: parseCommaList(document.querySelector('#moments').value, 12),
    moodTags: parseCommaList(document.querySelector('#moodTags').value, 12),
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

    const result = await response.json();
    const publicUrl = new URL(result.publicUrl, window.location.origin).toString();
    const adminUrl = new URL(result.adminUrl, window.location.origin).toString();
    document.querySelector('#publicUrlText').textContent = publicUrl;
    document.querySelector('#adminUrlText').textContent = adminUrl;
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

document.querySelectorAll('[data-copy-target]').forEach((button) => {
  button.addEventListener('click', async () => {
    const target = document.querySelector(`#${button.dataset.copyTarget}`);
    try {
      await navigator.clipboard.writeText(target.textContent);
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
