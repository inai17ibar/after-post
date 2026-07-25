// フロントエンド(素のJS)スクリプト共有のグローバル型定義。
// tsconfig.frontend.json からのみ読み込まれ、実行時には存在しない。
// 各シェイプはバックエンドのレスポンス(src/app.ts, src/lib/analytics.ts)と
// 手動で同期する(フロントはビルドしないためimportできない)。

/** src/lib/templates.ts の TemplateCatalogEntry と同じ形(events.templates の保存値) */
interface AfterPostTemplate {
  templateId: string;
  name: string;
  description: string;
  unlock: 'default' | 'qr' | 'generated';
}

/** GET /api/events/:eventId のレスポンス(src/app.ts serializePublicEvent) */
interface AfterPostEventConfig {
  eventId: string;
  eventName: string;
  eventSubTitle: string;
  venue: string;
  date: string;
  hashtags: string[];
  leadCopy: string;
  description: string;
  campaignText: string;
  moments: string[];
  moodTags: string[];
  templates: AfterPostTemplate[];
}

/** GET /api/admin/:eventId/dashboard のレスポンス(src/lib/analytics.ts DashboardStats) */
interface AfterPostDashboardStats {
  pageViews: number;
  qrViews: number;
  starts: number;
  generated: number;
  saved: number;
  shared: number;
  completionRate: number;
  shareRate: number;
  moods: [string, number][];
  moments: [string, number][];
  words: [string, number][];
  comments: string[];
  liveLogCount: number;
}

/** window.fetchAfterPostDashboard の戻り値(HTTPステータスをエラー種別に写像したもの) */
type AfterPostDashboardResult =
  | { error: 'forbidden' | 'not_found'; stats?: undefined }
  | { error?: undefined; stats: AfterPostDashboardStats };

/** POST /api/events/:eventId/logs の action(src/lib/validation.ts logActionSchema) */
type AfterPostLogAction =
  | 'page_view'
  | 'start_clicked'
  | 'moment_selected'
  | 'mood_selected'
  | 'text_submitted'
  | 'template_selected'
  | 'card_generated'
  | 'image_saved'
  | 'copy_clicked'
  | 'share_clicked';

interface AfterPostAnalyticsPayload {
  eventId?: string;
  source?: string;
  templateId?: string;
  moodTag?: string;
  momentType?: string;
  comment?: string;
}

// スクリプト読み込み順(event-config.js → analytics.js → app.js/admin.js)により、
// app.js/admin.js から見てこれらは常に定義済み。
interface Window {
  resolveAfterPostEventId: (pathname?: string, search?: string) => string | null;
  resolveAfterPostAdminParams: (pathname?: string) => { eventId: string; adminToken: string } | null;
  fetchAfterPostEvent: (eventId: string) => Promise<AfterPostEventConfig | null>;
  fetchAfterPostDashboard: (eventId: string, adminToken: string) => Promise<AfterPostDashboardResult>;
  AfterPostAnalytics: {
    getSessionId: () => string;
    trackEvent: (action: AfterPostLogAction, payload?: AfterPostAnalyticsPayload) => void;
  };
}
