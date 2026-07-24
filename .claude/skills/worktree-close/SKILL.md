---
name: worktree-close
description: >
  worktree での並列開発を締めくくり、成果を PR として引き渡してからセッションを元の
  ディレクトリに戻すためのスキル。検証 → コミット → push → PR 作成 → worktree を閉じる、を
  安全な順序で行う。ユーザーが「worktree を閉じて」「並列開発を終わって」「この作業を PR に
  して片付けて」「worktree から戻って」等と言ったとき、または worktree-open で始めた作業が
  一段落したときに使う。worktree を作って並列開発を始めるときは worktree-open スキルを使う。
---

# worktree-close — 並列開発を締めて PR に引き渡す

worktree で仕上げた作業を、壊れたまま押し込まずに PR として引き渡し、セッションを元の
ディレクトリへ戻す。順序が安全性を担保する――**確認してからしか push しない**。

## 手順

### 1. worktree セッションにいることを確認

```bash
git worktree list
pwd                        # worktree ディレクトリ配下にいるか
git branch --show-current
```

`EnterWorktree` で入った worktree でなければ `ExitWorktree` は no-op になる。生 git で
作った worktree の場合は末尾のフォールバックを見る。

### 2. 引き渡す前に確認する（壊れたものを push しない）

after-post は自動テストのゲートを持たないので、**目視と最小限の妥当性確認**を行う:

- 触った HTML/CSS/JS が壊れていないか（`git diff` で意図した変更だけか確認）。
- フロントエンドJS を変更したなら構文チェック: `node --check admin.js`（変更した `.js` それぞれに対して）。
- `src/`, `functions/`（TypeScript）を変更したなら `npm run typecheck` を通す。
- 可能なら `npm run dev`（`wrangler pages dev .`）でローカル表示を確認する。

**明らかに壊れている場合はここで止めて報告する。push も PR もしない。**

### 3. 未コミットの変更をコミットする

意味のあるメッセージで。**このリポジトリの既存のコミット規約に合わせる**
（`git log --oneline -20` で慣習を確認）。特に規約が無ければ Conventional Commits 形式
（`feat: ...` / `fix: ...` / `chore: ...`）を使う。コミットメッセージ末尾に
Co-Authored-By トレーラを付ける。

```bash
git add -A
git status               # 何が入るかを確認してから
git commit -m "fix: ..."
```

### 4. ブランチを push する

```bash
git push -u origin <branch>
```

### 5. PR を作る

`gh` で base（`main`）に向けて PR を作成する。本文に変更概要をまとめ、末尾に
Generated with Claude Code の行を入れる。**同名ブランチの PR が既にあれば新規作成せず**、
既存 PR の URL を報告する（`gh pr list --head <branch>` で確認）。

```bash
gh pr create --base main --head <branch> --title "..." --body "..."
```

PR 作成は外向きの操作。このスキルはまさにそれを行うために呼ばれているので進めてよいが、
作成後は URL を必ずユーザーに提示する。

### 6. worktree を閉じてセッションを戻す

`ExitWorktree` を `action: "keep"` で呼ぶ。これでセッションの cwd が元のディレクトリに戻り、
ブランチと worktree ディレクトリはディスク上に残る。push 済み・PR 済みなので成果は origin に
安全にあり、ローカルにも残るので追随の修正にすぐ戻れる。

> **remove したい場合**: push 済みなら削除しても成果は失われない（commit は origin にある）。
> ただし `ExitWorktree` の `remove` は「元ブランチに無い commit がある」と見なして拒否するため
> `discard_changes: true` が必要。この true は "push 済みだから消してよい" の意味で使う。既定は keep。

### 7. 報告する

PR の URL、ブランチ名、何を確認したか、セッションが元のディレクトリに戻ったことを伝える。

## 生 git でのフォールバック

`git worktree add` で作った worktree の場合、確認 → commit → push → `gh pr create` までは同じ。
片付けは自分で行う:

```bash
cd <元のディレクトリ>
git worktree remove <path>          # 未コミットがあると拒否される。--force は慎重に
```

## 注意

- 壊れている・コンフリクトがある状態で push や PR を強行しない。まず報告する。
- `--force` 系や `discard_changes: true` は「成果が origin に push 済み」を確認してからのみ。
  未 push の commit を破棄すると復旧できない。
