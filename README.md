# AFTER POST — AI Fan Voice Collector

ライブ終演後の感想からシェアカードをすぐに作り、Xへ投稿できるツールです。表向きはシェア体験に集中し、運営限定のフィードバックはカード完成後の任意導線に分離しています。

非エンジニアでも `/create/` からイベントページを自分で作成できます(ログイン不要、質問箱型)。詳しい開発ガイドは `AGENTS.md`、設計判断の経緯は `ADR.md` を参照してください。

## 起動

初回のみ:

```powershell
npm install
npx wrangler login
npx wrangler d1 create after-post-db   # 出力された database_id を wrangler.toml に反映
npm run migrate:local
```

起動:

```powershell
npm run dev
```

ブラウザで次のURLを開いてください(ポートは `wrangler pages dev` の出力を参照)。

- ファン画面(既存デモ): `http://localhost:8788/e/afterglow-2026-tokyo-day1/`
- QR流入確認: `http://localhost:8788/e/afterglow-2026-tokyo-day1/?src=qr`
- イベントをつくる: `http://localhost:8788/create/`
- 管理デモ: `http://localhost:8788/admin/demo/`

## 確認できること

- 自由記述から始まるシェアカード作成
- 投稿文の仕上がりトーン選択
- 公開投稿と運営限定フィードバックの分離
- Xで共有するカードのプレビュー
- Web Share APIによるPNG画像＋投稿文の共有（非対応環境は画像保存＋X Intent）
- スマートフォン向けレスポンシブ表示
- 非エンジニアでも使えるイベント作成フォーム(`/create/`)。公開URLと秘密の管理用リンクが発行される
- 3種類の背景テンプレートと生成後アンロック
- D1に永続化された集計ダッシュボード
- QR掲示カード

「読みやすく」は外部AIを使わず、ブラウザ内で文章を整えます。

## イベントを追加する

`/create/` のフォームから、コードを触らずにイベントページを作成できます。作成すると公開URL(`/e/{eventId}/`)と管理用リンク(`/admin/{eventId}/{adminToken}/`)が発行されます。**管理用リンクは作成時にしか表示されないため、必ずその場で保存してください。**
