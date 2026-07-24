const analytics = window.AfterPostAnalytics;

let eventConfig = null;
let unlockKey = null;
let afterEncoreUnlocked = false;

const state = {
  moment: '',
  mood: '',
  text: '',
  tone: 'そのまま',
  templateId: 'tokyo-day1-limited',
  generated: false,
  started: false,
  shareFilePromise: null,
};

const elements = {
  form: document.querySelector('#voiceForm'),
  input: document.querySelector('#voiceInput'),
  counter: document.querySelector('#charCount'),
  submit: document.querySelector('.submit-button'),
  moodStep: document.querySelector('#moodStep'),
  textStep: document.querySelector('#textStep'),
  finishStep: document.querySelector('#finishStep'),
  complete: document.querySelector('#complete'),
  shareCard: document.querySelector('#shareCard'),
  thanks: document.querySelector('#thanks'),
  support: document.querySelector('#shareSupport'),
};

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function applyEventConfig() {
  document.title = `${eventConfig.eventName} ${eventConfig.eventSubTitle} — AFTER POST`;
  setText('#heroDate', `${eventConfig.date} — ${eventConfig.venue}`);
  setText('#heroTitle', eventConfig.leadCopy);
  setText('#heroDescription', eventConfig.description);
  setText('#campaignText', eventConfig.campaignText);
  setText('#posterSubtitle', eventConfig.eventSubTitle);
  setText('#posterName', eventConfig.eventName);
  setText('#posterMeta', `${eventConfig.date} / ${eventConfig.venue}`);
}

function makeChoiceButton(value, kind) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'choice-pill';
  button.dataset.value = value;
  button.textContent = value;
  button.addEventListener('click', () => selectChoice(kind, value));
  return button;
}

function renderChoices() {
  const momentContainer = document.querySelector('#momentChoices');
  const moodContainer = document.querySelector('#moodChoices');
  eventConfig.moments.forEach((value) => momentContainer.appendChild(makeChoiceButton(value, 'moment')));
  eventConfig.moodTags.forEach((value) => moodContainer.appendChild(makeChoiceButton(value, 'mood')));
}

function unlockStep(element) {
  element.disabled = false;
  element.classList.remove('is-locked');
  element.classList.add('is-ready');
}

function selectChoice(kind, value) {
  if (kind === 'moment') markStarted();
  state[kind] = value;
  const container = document.querySelector(kind === 'moment' ? '#momentChoices' : '#moodChoices');
  container.querySelectorAll('.choice-pill').forEach((button) => {
    button.classList.toggle('selected', button.dataset.value === value);
  });
  analytics.trackEvent(kind === 'moment' ? 'moment_selected' : 'mood_selected', {
    eventId: eventConfig.eventId,
    momentType: state.moment,
    moodTag: state.mood,
  });
  if (kind === 'moment') unlockStep(elements.moodStep);
  if (kind === 'mood') unlockStep(elements.textStep);
  refreshGeneratedCard();
  validateForm();
}

function isTemplateUnlocked(template) {
  if (template.unlock === 'generated') return afterEncoreUnlocked || state.generated;
  return true;
}

function templateBadge(template) {
  if (template.unlock === 'qr') return 'EVENT LIMITED';
  if (template.unlock === 'generated' && !isTemplateUnlocked(template)) return 'LOCKED';
  if (template.unlock === 'generated') return 'UNLOCKED';
  return 'STANDARD';
}

function makeTemplateButton(template) {
  const unlocked = isTemplateUnlocked(template);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `template-option template-${template.templateId}`;
  button.dataset.template = template.templateId;
  button.disabled = !unlocked;
  button.classList.toggle('selected', state.templateId === template.templateId);
  button.innerHTML = `<span class="template-swatch"></span><span class="template-copy"><small>${templateBadge(template)}</small><b>${template.name}</b><em>${template.description}</em></span>`;
  if (unlocked) button.addEventListener('click', () => selectTemplate(template.templateId));
  return button;
}

function renderTemplateChoices() {
  ['#templateChoices', '#resultTemplateChoices'].forEach((selector) => {
    const container = document.querySelector(selector);
    container.innerHTML = '';
    eventConfig.templates.forEach((template) => container.appendChild(makeTemplateButton(template)));
  });
}

function selectTemplate(templateId) {
  state.templateId = templateId;
  renderTemplateChoices();
  analytics.trackEvent('template_selected', {
    eventId: eventConfig.eventId,
    templateId,
    moodTag: state.mood,
    momentType: state.moment,
  });
  refreshGeneratedCard();
  validateForm();
}

function validateForm() {
  elements.submit.disabled = !(state.moment && state.mood && state.text.trim() && state.templateId);
}

function formatComment(text, tone) {
  const trimmed = text.trim();
  if (tone !== '読みやすく') return trimmed;
  return trimmed
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .replace(/([。！？!?])\1+/g, '$1')
    .replace(/([^。！？!?])$/, '$1。');
}

function moodDesignKey(mood) {
  if (['最高', '元気をもらった'].includes(mood)) return 'max';
  if (['まだ浸ってる', '泣いた'].includes(mood)) return 'soak';
  if (['語りたい', '推しが尊い'].includes(mood)) return 'talk';
  return 'full';
}

function toneDesignKey(tone) {
  return { 'そのまま': 'raw', '読みやすく': 'readable', '熱量高め': 'energy' }[tone] || 'raw';
}

function buildCardModel() {
  const comment = formatComment(state.text, state.tone);
  return {
    eventId: eventConfig.eventId,
    eventName: eventConfig.eventName,
    subtitle: eventConfig.eventSubTitle,
    date: eventConfig.date,
    venue: eventConfig.venue,
    hashtag: eventConfig.hashtags[0],
    hashtags: eventConfig.hashtags.join(' '),
    comment,
    mood: state.mood,
    moment: state.moment,
    templateId: state.templateId,
    tone: toneDesignKey(state.tone),
    moodDesign: moodDesignKey(state.mood),
  };
}

function buildShareText(model) {
  return `${model.eventName} ${model.subtitle}、まだ余韻が抜けない。\n\n「${model.comment}」\n\n${model.hashtags}`;
}

function renderCard(model) {
  elements.shareCard.dataset.template = model.templateId;
  elements.shareCard.dataset.tone = model.tone;
  elements.shareCard.dataset.mood = model.moodDesign;
  setText('#cardEventName', model.eventName);
  setText('#cardSubtitle', model.subtitle);
  setText('#cardDate', `${model.date} / ${model.venue}`);
  setText('#cardQuote', `「${model.comment}」`);
  setText('#cardMood', model.mood);
  setText('#cardMoment', model.moment);
  setText('#cardHashtag', model.hashtag);
  setText('#cardVenue', `${model.date} · ${model.venue}`);
  setText('#limitedStamp', model.templateId === 'after-encore' ? 'AFTER ENCORE' : model.subtitle);
  setText('#shareNote', `${eventConfig.eventName}のイベント情報と公式ハッシュタグを含むカードです。`);
  state.shareFilePromise = createShareFile(model);
}

function refreshGeneratedCard() {
  if (!state.generated) return;
  state.text = elements.input.value;
  renderCard(buildCardModel());
}

elements.input.addEventListener('input', () => {
  state.text = elements.input.value;
  elements.counter.textContent = state.text.length;
  if (state.text.trim()) unlockStep(elements.finishStep);
  validateForm();
  refreshGeneratedCard();
});

document.querySelectorAll('input[name="tone"]').forEach((input) => {
  input.addEventListener('change', () => {
    state.tone = input.value;
    refreshGeneratedCard();
  });
});

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  state.text = elements.input.value;
  if (elements.submit.disabled) return;
  analytics.trackEvent('text_submitted', {
    eventId: eventConfig.eventId,
    comment: state.text,
    moodTag: state.mood,
    momentType: state.moment,
  });
  analytics.trackEvent('template_selected', {
    eventId: eventConfig.eventId,
    templateId: state.templateId,
    moodTag: state.mood,
    momentType: state.moment,
  });
  state.generated = true;
  const firstUnlock = !afterEncoreUnlocked;
  afterEncoreUnlocked = true;
  localStorage.setItem(unlockKey, 'true');
  renderTemplateChoices();
  renderCard(buildCardModel());
  analytics.trackEvent('card_generated', {
    eventId: eventConfig.eventId,
    templateId: state.templateId,
    moodTag: state.mood,
    momentType: state.moment,
  });
  elements.complete.classList.remove('hidden');
  document.querySelector('#unlockedNotice').classList.toggle('hidden', !firstUnlock);
  elements.complete.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

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

function paintTemplate(context, model, width, height) {
  const themes = {
    'standard-glow': ['#161633', '#4b3e82', '#2785a0'],
    'tokyo-day1-limited': ['#23162f', '#81486f', '#ed8255'],
    'after-encore': ['#09090d', '#1e1a28', '#735c32'],
  };
  const colors = themes[model.templateId];
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.58, colors[1]);
  gradient.addColorStop(1, colors[2]);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.save();
  context.strokeStyle = 'rgba(255,255,255,.2)';
  context.lineWidth = model.templateId === 'after-encore' ? 1 : 2;
  if (model.templateId === 'tokyo-day1-limited') {
    for (let x = -300; x < width + 300; x += 120) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x + 520, height); context.stroke();
    }
  } else {
    [260, 360, 460].forEach((radius) => {
      context.beginPath(); context.arc(1080, 40, radius, 0, Math.PI * 2); context.stroke();
    });
  }
  context.restore();
}

async function createShareFile(model) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 675;
  const context = canvas.getContext('2d');
  paintTemplate(context, model, canvas.width, canvas.height);

  context.fillStyle = '#fff';
  context.font = '800 25px "Noto Sans JP", sans-serif';
  context.fillText(model.eventName, 64, 58);
  context.textAlign = 'right';
  context.font = '700 20px "Noto Sans JP", sans-serif';
  context.fillText(model.subtitle, 1136, 58);
  context.textAlign = 'left';
  context.font = '500 17px "Noto Sans JP", sans-serif';
  context.fillStyle = 'rgba(255,255,255,.72)';
  context.fillText(`${model.date} / ${model.venue}`, 64, 93);

  const readable = model.tone === 'readable';
  const energy = model.tone === 'energy';
  if (readable) {
    context.fillStyle = 'rgba(255,255,255,.91)';
    context.fillRect(48, 130, 1104, 310);
  }
  context.fillStyle = readable ? '#211d28' : '#fff';
  context.font = energy
    ? 'italic 800 57px "Noto Sans JP", sans-serif'
    : readable
      ? '600 46px "Noto Sans JP", sans-serif'
      : '700 52px "Zen Old Mincho", "Noto Sans JP", serif';
  const quoteLines = wrapCanvasText(context, `「${model.comment}」`, 1030, 4);
  quoteLines.forEach((line, index) => context.fillText(line, 72, 205 + index * 68));

  context.fillStyle = readable ? '#211d28' : '#fff';
  context.font = '500 15px "Noto Sans JP", sans-serif';
  context.fillText('MOOD', 72, 500);
  context.fillText('FAVORITE MOMENT', 390, 500);
  context.font = '700 25px "Noto Sans JP", sans-serif';
  context.fillText(model.mood, 72, 535);
  context.fillText(model.moment, 390, 535);

  context.fillStyle = '#fff';
  context.font = '700 21px "Noto Sans JP", sans-serif';
  context.fillText(model.hashtag, 64, 625);
  context.textAlign = 'right';
  context.font = '500 16px "Noto Sans JP", sans-serif';
  context.fillText(`${model.eventName} · ${model.subtitle}`, 1136, 625);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('PNG generation failed')), 'image/png');
  });
  return new File([blob], `${eventConfig.eventId}-${state.templateId}.png`, { type: 'image/png' });
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showThanks(message) {
  elements.thanks.textContent = message;
  elements.thanks.classList.remove('hidden');
  setTimeout(() => elements.thanks.classList.add('hidden'), 2400);
}

document.querySelector('#saveImage').addEventListener('click', async () => {
  const file = await state.shareFilePromise;
  downloadFile(file);
  analytics.trackEvent('image_saved', { eventId: eventConfig.eventId, templateId: state.templateId });
  showThanks('✓ 画像を保存しました');
});

document.querySelector('#copyText').addEventListener('click', async () => {
  const text = buildShareText(buildCardModel());
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  analytics.trackEvent('copy_clicked', { eventId: eventConfig.eventId, templateId: state.templateId });
  showThanks('✓ 投稿文をコピーしました');
});

document.querySelector('#shareX').addEventListener('click', async () => {
  const button = document.querySelector('#shareX');
  const model = buildCardModel();
  const text = buildShareText(model);
  analytics.trackEvent('share_clicked', { eventId: eventConfig.eventId, templateId: state.templateId });
  button.disabled = true;
  button.textContent = '共有を準備中…';
  try {
    const file = await state.shareFilePromise;
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: `${model.eventName} ${model.subtitle}`, text, files: [file] });
      elements.support.textContent = '共有先でXを選んで投稿してください。';
    } else {
      downloadFile(file);
      analytics.trackEvent('image_saved', { eventId: eventConfig.eventId, templateId: state.templateId });
      window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
      elements.support.textContent = '画像を保存しました。Xの投稿画面で添付してください。';
    }
  } catch (error) {
    if (error.name !== 'AbortError') elements.support.textContent = '共有を開始できませんでした。もう一度お試しください。';
  } finally {
    button.disabled = false;
    button.textContent = 'Xで投稿する';
  }
});

function markStarted() {
  if (state.started) return;
  state.started = true;
  analytics.trackEvent('start_clicked', { eventId: eventConfig.eventId });
}

document.querySelector('#startButton').addEventListener('click', markStarted);

const aboutDialog = document.querySelector('#aboutDialog');
document.querySelector('#aboutButton').addEventListener('click', () => aboutDialog.showModal());
document.querySelector('#closeDialog').addEventListener('click', () => aboutDialog.close());
document.querySelector('#dialogOkay').addEventListener('click', () => aboutDialog.close());

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

async function init() {
  showStatus('読み込み中…');
  const eventId = window.resolveAfterPostEventId();
  if (!eventId) {
    showStatus('このイベントは見つかりませんでした。');
    return;
  }

  let fetchedConfig;
  try {
    fetchedConfig = await window.fetchAfterPostEvent(eventId);
  } catch (error) {
    showStatus('通信エラーが発生しました。もう一度お試しください。', { retry: true });
    return;
  }

  if (!fetchedConfig) {
    showStatus('このイベントは見つかりませんでした。');
    return;
  }

  eventConfig = fetchedConfig;
  unlockKey = `afterpost:unlocked:${eventConfig.eventId}:after-encore`;
  afterEncoreUnlocked = localStorage.getItem(unlockKey) === 'true';

  applyEventConfig();
  renderChoices();
  renderTemplateChoices();
  analytics.trackEvent('page_view', {
    eventId: eventConfig.eventId,
    source: new URLSearchParams(window.location.search).get('src') || 'direct',
  });
  hideStatus();
}

statusRetry.addEventListener('click', init);

init();
