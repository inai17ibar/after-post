// 任意の eventId に対して、常に同じHTMLシェル(afterglow-2026-tokyo-day1のマークアップ)を返す。
// 実際のイベント設定は app.js が /api/events/:eventId から取得するため、
// シェル自体はどのイベントでも共通でよい。
// 注意: Cloudflare PagesではFunctionsが静的アセットより優先されるため、
// 静的フォルダが存在する /e/afterglow-2026-tokyo-day1/ もこの関数を経由する
// (wrangler pages dev で確認済み。デモイベントもD1にシード済みなのでOGPは正しく付く)。
//
// 加えて、イベントがD1に存在する場合はOGPメタ(<meta property="og:*">等)を
// HTMLRewriterで<head>に注入して返す。SNSのスクレイパーはJSを実行しないため、
// app.jsによるクライアントサイド描画だけではOGPが反映されない。
// イベントが見つからない場合は従来どおりメタ注入なしでシェルを返す
// (app.js側の「イベントが見つかりません」表示を維持)。

type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
};

interface OgpEventRow {
  name: string;
  subtitle: string;
  lead_copy: string;
  description: string;
}

// OGP用のデフォルト画像(1200x630 PNG)。SVGはXのスクレイパーが解釈しないためPNGを使う。
const OGP_IMAGE_PATH = '/assets/ogp-default.png';

export const onRequest: PagesFunction<Env> = async (context) => {
  const shellUrl = new URL('/e/afterglow-2026-tokyo-day1/', context.request.url);
  const response = await context.env.ASSETS.fetch(new Request(shellUrl, context.request));

  const param = context.params.eventId;
  const eventId = Array.isArray(param) ? param[0] : param;
  if (!eventId) {
    return new Response(response.body, response);
  }

  let row: OgpEventRow | null = null;
  try {
    row = await context.env.DB.prepare(
      'SELECT name, subtitle, lead_copy, description FROM events WHERE id = ?',
    )
      .bind(eventId)
      .first<OgpEventRow>();
  } catch {
    row = null;
  }
  if (!row) {
    return new Response(response.body, response);
  }

  const origin = new URL(context.request.url).origin;
  const metaValues: Record<string, string> = {
    'og:title': row.subtitle ? `${row.name} ${row.subtitle}` : row.name,
    'og:description': row.lead_copy || row.description,
    'og:url': `${origin}/e/${eventId}/`,
    'og:type': 'website',
    'og:image': `${origin}${OGP_IMAGE_PATH}`,
    'twitter:card': 'summary_large_image',
  };

  // 1パス目: content が空の静的な<meta>スケルトンだけを<head>へ注入する。
  // ここで注入するHTML文字列に動的な値は一切含めない(ADR-0004: stored XSS対策)。
  const skeletonInjector = new HTMLRewriter().on('head', {
    element(head) {
      head.append('<meta property="og:title" content="">', { html: true });
      head.append('<meta property="og:description" content="">', { html: true });
      head.append('<meta property="og:url" content="">', { html: true });
      head.append('<meta property="og:type" content="">', { html: true });
      head.append('<meta property="og:image" content="">', { html: true });
      head.append('<meta name="twitter:card" content="">', { html: true });
    },
  });

  // 2パス目: 注入済みスケルトンの content を setAttribute で設定する。
  // HTMLRewriterが属性値として適切にエスケープするため、第三者入力の
  // イベント名等を含んでいてもHTMLとして解釈されない。
  let valueSetter = new HTMLRewriter();
  for (const [key, value] of Object.entries(metaValues)) {
    const selector =
      key === 'twitter:card' ? `meta[name="${key}"]` : `meta[property="${key}"]`;
    valueSetter = valueSetter.on(selector, {
      element(meta) {
        meta.setAttribute('content', value);
      },
    });
  }

  const withSkeleton = skeletonInjector.transform(new Response(response.body, response));
  return valueSetter.transform(withSkeleton);
};
