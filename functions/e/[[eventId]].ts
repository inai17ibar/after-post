// 任意の eventId に対して、常に同じHTMLシェル(afterglow-2026-tokyo-day1のマークアップ)を返す。
// 実際のイベント設定は app.js が /api/events/:eventId から取得するため、
// シェル自体はどのイベントでも共通でよい。既存の e/afterglow-2026-tokyo-day1/ は
// 静的ファイルとして先にマッチするため、この関数を経由しない(そのまま動き続ける)。
export const onRequest: PagesFunction = async (context) => {
  const shellUrl = new URL('/e/afterglow-2026-tokyo-day1/', context.request.url);
  const response = await context.env.ASSETS.fetch(new Request(shellUrl, context.request));
  return new Response(response.body, response);
};
