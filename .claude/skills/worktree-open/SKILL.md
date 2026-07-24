---
name: worktree-open
description: >
  独立した git worktree を作ってセッションをそこへ移し、他のエージェント/セッションが
  編集中の作業ツリーを一切汚さずに並列開発を始めるためのスキル。
  ユーザーが「worktree を作って作業して」「並列で開発したい」「別のエージェントの邪魔を
  せずに直したい」「隔離した環境でこのタスクをやって」等と言ったとき、または同じリポジトリで
  複数の作業を同時に進めたいときに使う。after-post のフロントエンドはビルド不要な静的サイト
  だが、バックエンド(Cloudflare Workers + D1)は `npm install` とローカルD1マイグレーションが
  必要。worktree を作ってすぐ編集・プレビューできる状態にするところまでを担う。
  作業を終えて PR を出し worktree を閉じるときは worktree-close スキルを使う。
---

# worktree-open — 隔離 worktree で並列開発を始める

同じリポジトリで別のエージェント/セッションがファイルを編集している状況で、その作業を
一切汚さずに自分のタスクを進めたい――これが worktree の使いどころ。worktree は `.git` を
共有しつつ、独立した作業ディレクトリと独立したブランチを持つ。だから各セッションは自分の
ディレクトリ・ブランチ・作業ファイルを持ち、互いのチェックアウトを踏まない。

**after-post はビルドも依存インストールも無い静的サイト**（`index.html` / `styles.css` /
`*.js` を直接配信）。そのため worktree を作った時点でほぼ即座に編集できる。このスキルの
主眼は「隔離した作業ブランチを安全に立ち上げ、必要ならローカルプレビューを用意する」こと。

## 手順

### 1. 前提を確認する

```bash
git worktree list          # 既存 worktree と、今どこにいるかを把握
git rev-parse --show-toplevel
```

- git リポジトリ内であること。
- **すでに worktree セッション中なら新規作成はできない**（`EnterWorktree` の name 作成は
  ネスト不可）。その場合は一度 worktree-close で戻ってから始める。

### 2. ブランチ名（＝worktree 名）を branch-namer スキルで決める

`EnterWorktree` に渡す `name` は **worktree ディレクトリ名であると同時に新ブランチ名**に
なる。ブランチ名は後から PR に載り、`git branch` にチームの他ブランチと並ぶ。命名は
**必ず branch-namer に通す**——ここで自前で名前を決め打ちすると、命名規則の一貫性を担保する
意味が失われる。

**この手順では、名前を自分で考える前に Skill ツールで `branch-namer` を実際に呼び出すこと。**
呼び出し時には「この worktree のブランチ名を決めたい。作業内容は〈日本語のタスク説明〉」と渡す。

branch-namer を起動したうえで、以下を守る:

- branch-namer の**手順 1〜3 の成果（リポジトリ慣習の観察 → 日本語入力の解釈 → 候補提案）
  だけを使う**。確定した名前をこの worktree の `name` として次の手順に渡す。
- **branch-namer の手順 4（`git switch -c`）まで進ませない。** ブランチ作成は次の手順の
  `EnterWorktree` が行う。branch-namer 側にも「候補確定まで」と伝える。
- 対話可能なら branch-namer が AskUserQuestion で候補を出すので、ユーザーに選んでもらう。
  対話不可なら推奨候補（先頭）を採用する。

得られた名前は `EnterWorktree` の `name` 制約（各 `/` 区切りセグメントは英数字・`.`・`_`・
`-` のみ、全体 64 文字以内）を満たすこと。

### 3. ベースを最新化してから作る

デフォルトは **origin のデフォルトブランチ `main` から fresh に切る**。未コミットや進行中の
作業を引き継がない、独立したタスク向けの既定。ローカルの `origin/main` が古いと fresh の
意味が薄れるので、先に取得する:

```bash
git fetch origin main
```

そのうえで `EnterWorktree` を呼ぶ（`name` に手順 2 で確定した名前を渡す）。これは:
- worktree ディレクトリにリポジトリを worktree として作り、
- `worktree.baseRef=fresh`（既定）で `origin/main` から `<name>` という新ブランチを切り、
- **セッションのカレントディレクトリをその worktree に切り替える**。

> **fresh か head か**: 進行中の作業の上に積む並列タスクなら現在の HEAD から切りたい
> （`worktree.baseRef` を `head`）。タスクが今の未コミット変更に依存するかで判断する。既定は fresh。

### 4. worktree を「使える」状態にする

フロントエンド(`index.html` などの素のJS/HTML/CSS)は依存インストール不要でそのまま編集できる。
バックエンド(`src/`, `functions/`, D1)を触る・動作確認する場合は、worktree内で以下が必要:

```bash
# worktree のルートで
npm install
npx wrangler d1 migrations apply after-post-db --local   # ローカルD1に反映
npm run dev   # wrangler pages dev . → http://localhost:8788/ 付近で起動
```

`/create/` でイベントを作成し、発行された `/e/{id}/` `/admin/{id}/{token}/` で確認する。
既存デモは `/e/afterglow-2026-tokyo-day1/` と `/admin/demo/`（本物の管理URLへリダイレクト）。
サーバは編集の確認に使うだけで、起動は必須ではない。

### 5. 隔離できていることを確認して報告

`git branch --show-current` と `pwd` で、新ブランチ・worktree ディレクトリ配下にいることを
確認する。ここでの編集はメインの checkout にも他エージェントの worktree にも影響しない。
準備ができたら、worktree のパス・ブランチ名をユーザーに伝えてから本題の作業に入る。

## 生 git でのフォールバック（EnterWorktree が使えない素の端末など）

`<branch>` は手順 2 と同じく branch-namer で決めた名前を使う。

```bash
git fetch origin main
git worktree add -b <branch> ../wt-<name> origin/main
cd ../wt-<name>
# 必要ならプレビュー: python3 -m http.server 8000
```

注意点:
- 素の `cd` は Claude Code のセッション cwd を跨いで永続しない（各 Bash 呼び出しで戻る）。
- 未コミット変更を失わないためのガードも無い。閉じるときは自分で `git worktree remove` する。

## 注意

- サブエージェントを隔離したいなら Agent 起動時の `isolation: "worktree"` を使う。
- worktree の作成自体は可逆（ローカルのみ）。push や PR はまだしない。片付けと PR は
  **worktree-close** スキルの担当。
