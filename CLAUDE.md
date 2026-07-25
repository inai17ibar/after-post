# CLAUDE.md — Claude Code 向け補足

このリポジトリで作業するClaude Code向けの補足情報です。プロジェクト全体の説明・開発規約は `AGENTS.md`、個々の設計判断の経緯は `ADR.md` にあります。作業前に両方に目を通してください。

## このリポジトリの要点（一言で）

ライブ終演後のシェアカードを作るツールです。フロントエンドはビルドなしのvanilla JS/HTML/CSSですが、2026-07-24にセルフサーブのイベント作成機能追加に伴いCloudflare Workers + D1のバックエンドを導入しました（[[ADR-0006]]参照、テストは引き続きなし）。詳細は `AGENTS.md` 参照。

## 別のPC・別のClaudeアカウントから開発する場合の注意

- リモートは GitHub（`origin`）で、SSHのホストエイリアス `github.com-inai17ibar` を使って接続している（`git remote -v` で確認可能）。新しい環境では以下のどちらかが必要:
  - その環境の `~/.ssh/config` に `Host github.com-inai17ibar` のエントリ（対象GitHubアカウントの鍵を指すもの）を用意する、または
  - `git remote set-url origin <その環境で有効なURL>` でリモートURLをその環境向けに変更する。
- 設定が無いまま `git pull` / `git push` すると認証エラーになる。作業開始時に一度 `git fetch` などで疎通確認しておくとよい。
- このリポジトリには `.claude/skills/` に `worktree-open` / `worktree-close` / `branch-namer` がある。同一マシン上で複数セッションを並行させたいとき（例: 別のエージェントが編集中のツリーを汚さず作業したいとき）は `worktree-open` → 作業 → `worktree-close` の流れを使う。これは同一マシン内の並行作業向けであり、別PCからの開発そのものには関係しない（そちらは上記のGit/SSH設定の話）。

## 動作確認について

自動テストは存在しませんが、`npm run typecheck` でバックエンド(TypeScript)とフロントエンド(JSDoc型注釈付きJS、[[ADR-0007]]参照)の両方の型チェックができます。フロントJSを編集したら型注釈も維持してください（`.ts`化はしない — ビルド導入になるため）。`python -m http.server` だけではAPIが無いため動きません。コードを変更したら、必ず `npm run dev`（`wrangler pages dev .`）でローカルに立ち上げ、実際にブラウザで該当画面を触って確認してください（`AGENTS.md`の起動セクション参照）。「エラーが出ない」ことと「意図通り動く」ことは別物です。

## 特に注意すべき規約

- ユーザー入力（感想テキストなど）をDOMに挿入する際は`innerHTML`を使わない。`textContent`かDOM APIのみ。背景は `ADR.md` の ADR-0004（過去にstored XSSがあり修正済み）。
- スクリプトの読み込み順（`event-config.js` → `analytics.js` → `app.js`/`admin.js`）を前提にしたグローバル関数呼び出しになっているため、順序を変えない。
- バックエンド(`src/`, `functions/`)はTypeScript + Hono + zod + wrangler(D1)を使う。フロントエンド(素のJS/HTML/CSS)には引き続き新しい依存やビルドツールを持ち込まない（`ADR.md` ADR-0006、ADR-0001は Superseded）。
