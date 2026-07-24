export interface TemplateCatalogEntry {
  templateId: string;
  name: string;
  description: string;
  unlock: 'default' | 'qr' | 'generated';
}

// app.js の paintTemplate() がこの3つの templateId をキーに固定のカラーテーマを
// 描画するため、templateId 自体は増減・改名しない。name/description はどのイベントにも
// 使える汎用表現にしてある(イベント固有の文言は events.templates 側の保存値で上書きされる)。
export const TEMPLATE_CATALOG: TemplateCatalogEntry[] = [
  { templateId: 'standard-glow', name: 'Standard', description: '定番のグラデーションカード。', unlock: 'default' },
  { templateId: 'tokyo-day1-limited', name: 'Bold Accent', description: '斜めのラインが入った、目を引くデザイン。', unlock: 'qr' },
  { templateId: 'after-encore', name: 'Encore Unlock', description: 'カード生成後に解放される特別カラー。', unlock: 'generated' },
];

export const TEMPLATE_IDS = TEMPLATE_CATALOG.map((entry) => entry.templateId) as [string, ...string[]];
