// /admin/demo/          -> 移行済みデモイベントの本物の管理URLへ302リダイレクト
// /admin/{eventId}/{adminToken}/ -> 共通の管理ダッシュボードシェル(admin/shell.html)を返す
//   トークンの正当性チェックは admin.js が /api/admin/:eventId/dashboard 呼び出し時に行う。
interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const segments = ((context.params.path as string | string[] | undefined) ?? []);
  const parts = Array.isArray(segments) ? segments : [segments];

  if (parts.length === 1 && parts[0] === 'demo') {
    const demo = await context.env.DB.prepare(
      'SELECT id, admin_token FROM events WHERE is_demo = 1 LIMIT 1',
    ).first<{ id: string; admin_token: string }>();
    if (!demo) return new Response('Demo event not seeded', { status: 404 });
    const target = new URL(`/admin/${demo.id}/${demo.admin_token}/`, context.request.url);
    return Response.redirect(target.toString(), 302);
  }

  if (parts.length >= 2 && parts[0] && parts[1]) {
    // 拡張子付き(/admin/shell.html)でfetchするとアセットサーバーがpretty URLへの
    // 308リダイレクトを返し、それがそのままブラウザに届いてしまうため拡張子なしで取得する
    const shellUrl = new URL('/admin/shell', context.request.url);
    const response = await context.env.ASSETS.fetch(new Request(shellUrl, context.request));
    return new Response(response.body, response);
  }

  return new Response('Not found', { status: 404 });
};
