# AGENTS.md — after-post 開発ガイド

このファイルは、人間・AIエージェントを問わず、このリポジトリで開発する全員向けの共通ガイドです。
Claude Code 固有の設定は `CLAUDE.md`、個々の設計判断の経緯は `ADR.md` を参照してください。

## プロジェクト概要

AFTER POST は、ライブ終演後の感想からシェアカード（PNG画像＋投稿文）を作りXへ投稿できるツールです。
2026-07-24のバックエンド導入（[[ADR-0006]]参照）により、非エンジニアの第三者（公式運営に限らず非公式のファンも含む）がログイン不要でイベントページを自分で作成できるマルチテナント構成になっています。フロントエンドは静的HTML/CSS/vanilla JSのまま、バックエンドはCloudflare Workers + D1 + Pages Functionsです。

- 表向き: ファンがその場で感想を選び、カードを作ってXに共有する体験（`/e/{eventId}/`）
- 表向き(作成者): ログイン不要でイベントページを自分で作る（`/create/`）。作成すると公開URLと、秘密の管理用リンク（質問箱型・再表示不可）が発行される
- 裏向き: 運営限定フィードバックの収集と、D1に永続化された集計ダッシュボード（`/admin/{eventId}/{adminToken}/`）

詳しい機能一覧はトップの `README.md` を参照してください。

## 起動・動作確認

初回のみ:
```powershell
npm install
npx wrangler login
npx wrangler d1 create after-post-db   # 出力された database_id を wrangler.toml に反映
npm run migrate:local
```

起動:
```powershell
npm run dev   # wrangler pages dev . 。python -m http.server では動かない(APIがないため)
```

- ファン画面(既存デモ): `http://localhost:8788/e/afterglow-2026-tokyo-day1/`
- QR流入確認: `http://localhost:8788/e/afterglow-2026-tokyo-day1/?src=qr`
- イベント作成: `http://localhost:8788/create/`
- 管理デモ: `http://localhost:8788/admin/demo/`（実際の管理URLへ302リダイレクトされる）

自動テストは存在しませんが、`npm run typecheck` でバックエンド（TypeScript）とフロントエンド（JSDoc型注釈付きJS、`tsconfig.frontend.json`でcheckJs検査。[[ADR-0007]]参照）の両方の型チェックができます。**変更後は必ず `npm run dev` を起動し、上記URLをブラウザで実際に触って確認してください。** 型チェックが通ることと、機能が意図通り動くことは別物です。

**Windows特有の注意:** `wrangler pages dev` にCLIの `--d1` フラグを付けると、`wrangler.toml` 側のD1バインディングと二重定義になりworkerdバイナリがネイティブクラッシュ（`std::terminate() called with no exception`）することが確認されている。D1バインディングは`wrangler.toml`の`[[d1_databases]]`だけで十分で、CLIフラグは不要。また使用ポートが他プロセス（VS Codeなど）と衝突していると同様の紛らわしいクラッシュ表示になることがあるため、`Get-NetTCPConnection -State Listen`で先にポートの空き状況を確認するとよい。

## ディレクトリ構成

```
index.html               トップ。既定イベントへ即リダイレクトするだけ(変更なし)
event-config.js          URL(パス/クエリ)からのイベントID解決 + /api へのfetchヘルパー
analytics.js             匿名セッションID管理 + ログ送信(fire-and-forget)のfetchラッパー
app.js                   ファン向けカード作成画面のロジック(async init、e/配下から読み込まれる)
admin.js                 管理ダッシュボードのロジック(async init、admin/配下から読み込まれる)
create/index.html, create.js, create.css   イベント作成フォーム(非エンジニア向け自己サービス)
styles.css               ファン向け画面 + ローディング/エラー用status-overlayのスタイル
admin.css                管理ダッシュボードのスタイル
e/afterglow-2026-tokyo-day1/index.html   全イベント共通のファン向けHTMLシェル(物理的な複製はもう不要)
admin/shell.html          全イベント共通の管理ダッシュボードHTMLシェル
assets/                   QR画像などの静的アセット
functions/api/[[route]].ts       Honoアプリ(src/app.ts)をマウントするPages Function
functions/e/[[eventId]].ts       任意のeventIdに共通のファン向けシェルを返すルーティング
functions/admin/[[path]].ts      /admin/demoのリダイレクト + 任意イベントの管理シェル配信
src/app.ts                Honoルートハンドラ本体(POST /events, GET /events/:id, POST /events/:id/logs, GET /admin/:id/dashboard)
src/lib/                  token.ts(管理トークン生成), templates.ts(固定テンプレートカタログ), validation.ts(zodスキーマ), analytics.ts(サーバー側集計)
migrations/               D1マイグレーション(0001_init.sql, 0002_seed_demo.sql)
types/frontend.d.ts       フロントJS共有のグローバル型定義(APIレスポンス形・window拡張。src/と手動同期)
wrangler.toml, tsconfig.json, package.json   Cloudflare Workers/D1の設定
tsconfig.frontend.json    フロントJSの型検査(checkJs)用設定。ビルドはしない(ADR-0007)
```

## アーキテクチャの要点

- **イベント設定の唯一の情報源はD1の`events`テーブル。** `event-config.js`の`resolveAfterPostEventId()`がURLパス`/e/{eventId}/`またはクエリ`?event=`からIDを特定し、`window.fetchAfterPostEvent(eventId)`が`GET /api/events/:eventId`を叩いて取得する。旧`event-config.js`のハードコード`events`オブジェクトは廃止済み。
- **スクリプトの読み込み順に依存がある。** 各HTMLは `event-config.js` → `analytics.js` → `app.js`（または `admin.js`）の順で読み込む前提。モジュールバンドラは使っていないため、この順序を崩さないこと。
- **`app.js`/`admin.js`は非同期初期化。** どちらも`async function init()`でイベント取得→描画を行い、`#statusOverlay`でローディング中・イベント未検出・通信エラー(リトライ可)・管理者権限なし(admin.jsのみ)を出し分ける。トップレベルでイベントリスナーは張るが、実際のデータ参照はinit完了後のみ発生する。
- **分析ログはD1に永続化。** `analytics.js`の`trackEvent()`は`POST /api/events/:id/logs`へのfire-and-forgetなfetchになり、集計は`src/lib/analytics.ts`（サーバー側）が`GET /api/admin/:id/dashboard`で計算して返す。デモ用の下駄（旧`demoSeed`）は`events.is_demo = 1`のイベントにのみ加算される。
- **管理権限は秘密リンクの所持のみ。** `/admin/{eventId}/{adminToken}/`のトークンが唯一の認可情報で、ログインの概念はない（質問箱型）。トークン不一致は403、イベント不在は404として明確に区別する。
- **どのeventIdでも同じHTMLシェルを返す。** `functions/e/[[eventId]].ts`と`functions/admin/[[path]].ts`が、物理フォルダの有無に関わらず`e/afterglow-2026-tokyo-day1/index.html`・`admin/shell.html`をそのまま返す。実際のイベント固有データはJS側がAPIから取得する。
- **カード画像はCanvasでその場生成（変更なし）。** `app.js` の `createShareFile()` が `<canvas>` に描画してPNG Blobを作り、対応端末では Web Share API（`navigator.share`）でXへの共有導線に渡し、非対応環境では画像ダウンロード＋X Intent URLにフォールバックする。テンプレートは`src/lib/templates.ts`の固定カタログ(3種)から選ぶ方式で、自由なデザイン編集はできない。

## 新しいイベントを追加する

**エンジニアでなくても** `/create/` のフォームから作成できる。eventId(スラッグ)・名前・会場・日付・コピー・ハッシュタグ・選択肢(カンマ区切り)・使用テンプレートを入力して送信すると、公開URL(`/e/{eventId}/`)と管理用リンク(`/admin/{eventId}/{adminToken}/`)が発行される。**管理用リンクは作成時にしか表示されないため、必ず作成者自身が控える必要がある。** コードを触ってイベントを追加する運用は廃止した(旧: `event-config.js`編集 + フォルダ複製)。

## 守るべき規約

- **ユーザー入力をDOMに挿入するときは `innerHTML` を使わず、`textContent` またはDOM APIで組み立てる。** 過去に管理ダッシュボードのコメント表示欄で `innerHTML` によるstored XSSが発生し修正済み（ADR-0004参照）。感想テキストなどユーザー由来の値をHTML文字列に埋め込むコードは書かないこと。
- **外部からの入力(POSTボディ)は必ずAPI側(`src/lib/validation.ts`のzodスキーマ)で検証する。** クライアント側のバリデーションだけを信用しない。
- コミットメッセージは英語・命令形で簡潔に（例: `Fix stored XSS in admin dashboard comments; make event config extensible`）。

## Git運用・複数環境での開発

- リモートは GitHub（`origin`）で、SSH経由・ホストエイリアス `github.com-inai17ibar` を使用している。**別のPC/別のGitHubアカウントからこのリポジトリを開発する場合、そのマシンの `~/.ssh/config` に同名の `Host github.com-inai17ibar` エントリ（対象アカウントの鍵を指す）を用意するか、`git remote set-url origin <そのマシンで有効なURL>` でリモートURLを合わせる必要がある。** 設定していないと `git pull` / `git push` が失敗する。
- ブランチは現状 `main` のみ。作業ブランチを切る場合は分かりやすい英語名にする（日本語の作業内容から英語ブランチ名を考えるときは `.claude/skills/branch-namer` が使える）。
- push・force-push・履歴書き換えなど破壊的操作は必ず事前に確認を取ってから行う。
