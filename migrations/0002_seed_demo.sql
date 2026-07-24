-- 既存のハードコードイベント(afterglow-2026-tokyo-day1)を is_demo=1 として移行する。
-- admin_token はローカル開発専用の固定値。本番投入時は POST /api/events 経由で発行し、
-- 発行された本番トークンはこのファイルにもリポジトリにもコミットしないこと。
INSERT INTO events (
  id, admin_token, name, subtitle, venue, event_date,
  hashtags, lead_copy, description, campaign_text,
  moments, mood_tags, templates, is_demo
) VALUES (
  'afterglow-2026-tokyo-day1',
  'local-dev-demo-admin-token-do-not-use-in-prod',
  'AFTER GLOW 2026',
  'TOKYO DAY1',
  'TOKYO ARENA',
  '2026.07.12',
  '["#AFTERGLOW2026","#AFTERPOST","#今日の余韻"]',
  '今日の余韻を、限定カードに。',
  'まとまっていない言葉でも大丈夫。今夜だけのシェアカードをつくって、Xへ届けよう。',
  'カードを保存・投稿した方の中から抽選で、AFTER GLOW限定メモリアルカードをプレゼント。',
  '["曲","MC","演出","衣装","推し","会場の空気","アンコール"]',
  '["胸がいっぱい","泣いた","最高","まだ浸ってる","語りたい","元気をもらった","推しが尊い"]',
  '[{"templateId":"standard-glow","name":"Standard Glow","description":"紫から青へ、光の余韻を残す定番カード。","unlock":"default"},{"templateId":"tokyo-day1-limited","name":"Tokyo Day1 Limited","description":"会場と日付を刻んだ、DAY1だけの限定デザイン。","unlock":"qr"},{"templateId":"after-encore","name":"After Encore","description":"カード生成後に現れる、深夜のアンコールカラー。","unlock":"generated"}]',
  1
);
