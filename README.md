# AFTER POST — AI Fan Voice Collector

ライブ終演後の感想からシェアカードをすぐに作り、Xへ投稿できるUIプロトタイプです。表向きはシェア体験に集中し、運営限定のフィードバックはカード完成後の任意導線に分離しています。

## 起動

```powershell
cd C:\src\ai-fan-voice-collector
python -m http.server 4173
```

ブラウザで次のURLを開いてください。

- ファン画面: `http://localhost:4173/e/afterglow-2026-tokyo-day1/`
- QR流入確認: `http://localhost:4173/e/afterglow-2026-tokyo-day1/?src=qr`
- 管理デモ: `http://localhost:4173/admin/demo/`

## このプロトタイプで確認できること

- 自由記述から始まるシェアカード作成
- 投稿文の仕上がりトーン選択
- 公開投稿と運営限定フィードバックの分離
- Xで共有するカードのプレビュー
- Web Share APIによるPNG画像＋投稿文の共有（非対応環境は画像保存＋X Intent）
- スマートフォン向けレスポンシブ表示
- イベント設定による専用ページ
- 3種類の背景テンプレートと生成後アンロック
- 匿名localStorageログとデモ集計ダッシュボード
- QR掲示カード

本デモはバックエンドを使用しません。操作ログは同一オリジンのlocalStorageに匿名セッション単位で保存され、管理画面では固定デモ値に加算されます。「読みやすく」は外部AIを使わず、ブラウザ内で文章を整えます。
