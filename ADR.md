# ADR — Architecture Decision Records

after-post における主要な設計判断の記録です。新しい判断を行った・既存の判断を覆した際は、末尾に追記してください（既存エントリは編集せず、Statusを更新するかSupersededを追記する）。

各エントリは次の形式です。

```
## ADR-XXXX: タイトル
- Status: Accepted / Superseded by ADR-YYYY
- Context: 何が問題だったか
- Decision: 何を決めたか
- Consequences: その結果何が得られ、何を犠牲にしたか
```

---

## ADR-0001: バックエンドを持たない静的サイトとして構築する
- Status: Superseded by [[ADR-0006]]
- Context: イベント終演直後という短時間・大量アクセスが想定される場面で、素早く確実にファン体験を提供したい。サーバー運用・デプロイの複雑さは避けたい。
- Decision: サーバーサイド処理を一切持たない静的HTML/CSS/JSのみで構成する。ビルドステップやバンドラも導入しない。`python -m http.server` でそのまま配信できる状態を維持する。
- Consequences: インフラ運用コストがほぼゼロになる一方、実データの永続化・突合はできない（[[ADR-0002]]参照）。新しい依存を追加する際はCDN読み込みなど無ビルドで完結する形にする必要がある。

## ADR-0002: 分析ログはlocalStorageベースの匿名集計とする
- Status: Superseded by [[ADR-0006]]
- Context: 本番相当のバックエンドがない中で、デモとして「それらしい集計ダッシュボード」を見せたい。個人情報も扱いたくない。
- Decision: `analytics.js` が同一オリジンの`localStorage`にセッション単位・匿名のイベントログ（`page_view`, `start_clicked`, `card_generated` など）を蓄積する。`admin.js`はこのログを固定のデモシード値（`demoSeed`）に加算して表示し、実データとデモ値の区別なくひとつの数字として見せる。
- Consequences: 端末・ブラウザをまたいだ集計はできず、あくまでローカルデモ用途に限定される。将来サーバー集計に置き換える場合は`AfterPostAnalytics`のインターフェース（`trackEvent`, `getDashboardStats`）を維持すれば呼び出し側の変更を最小化できる。

## ADR-0003: イベント設定を単一オブジェクトに集約し、複製ベースで追加する
- Status: Superseded by [[ADR-0006]]
- Context: 会場・日程ごとに見た目やコピーが変わる複数イベントを、コードを複雑にせず素早く追加できるようにしたい。
- Decision: `event-config.js`の`events`オブジェクトをイベント情報の唯一の情報源とし、`resolveEventId()`がURLパス`/e/{eventId}/`またはクエリ`?event=`からイベントを解決する。新規イベントは「`events`にエントリを追加」＋「`e/{eventId}/`フォルダを複製」の2手順で完結させる（README・AGENTS.md参照）。
- Consequences: イベント数が増えてもロジック分岐は増えないが、`e/`配下のHTMLはイベントごとに物理的に複製されるため、マークアップ自体に手を入れる変更は全イベントフォルダへの反映漏れに注意が必要。

## ADR-0004: ユーザー入力をDOMへ挿入する際はinnerHTMLを禁止しtextContent/DOM APIのみ使う
- Status: Accepted
- Context: 2026-07-24、管理ダッシュボードの代表コメント表示（`admin.js`）で、ファンが入力した感想テキストを`blockquote.innerHTML = `...${comment}...``という形でテンプレートリテラル経由でHTMLに埋め込んでいたため、stored XSSが成立する状態になっていた（コメントに`<script>`等を含めると管理画面側で実行される）。
- Decision: ユーザー由来の値（感想テキスト、将来追加され得る自由入力全般）をDOMに反映する処理では、`innerHTML`へのテンプレートリテラル埋め込みを禁止し、`textContent`への代入または`document.createElement`によるDOM構築のみを用いる。該当コミット: `dd05e67`。
- Consequences: DOM構築のコードがやや冗長になる（`el.textContent = ...`を複数行書く必要がある）が、エスケープ漏れによるXSSのクラスを構造的に排除できる。新しい画面・機能を追加する際も、コメント欄など自由入力を表示する箇所では同じパターンを踏襲すること。

## ADR-0005: カード画像はクライアントのCanvasでその場生成し、共有はWeb Share APIを優先しフォールバックする
- Status: Accepted
- Context: サーバーで画像を合成する仕組みを持たない（[[ADR-0001]]）中で、テンプレートごとに異なるデザインのシェア画像をその場で作り、Xへの投稿導線までつなげる必要がある。
- Decision: `app.js`の`createShareFile()`が`<canvas>`にテンプレートごとの背景・文言を描画し、`canvas.toBlob()`でPNGの`File`を生成する。共有時は`navigator.share`＋`navigator.canShare({ files })`が使える環境ではファイル付きWeb Share APIを使い、使えない環境では画像をダウンロードさせたうえで`https://x.com/intent/post`をポップアップで開くフォールバックに切り替える。
- Consequences: サーバーサイド画像処理が不要になる一方、Canvasのレイアウト・フォントはテンプレート追加のたびに`paintTemplate()`へ手作業で描画コードを足す必要があり、テンプレート数が増えるとこの関数が肥大化しやすい。カード画像生成自体は[[ADR-0006]]後もクライアントCanvasのまま変更していない。

## ADR-0006: セルフサーブのイベント作成を可能にするため、Cloudflare Workers + D1 のバックエンドを導入する
- Status: Accepted
- Context: 2026-07-24、要件が「開発者自身がイベントを追加する」から「非エンジニアの第三者（公式運営に限らず非公式のファンも含む）がログイン不要でイベントページを自分で作成し、参加者や他の運営者からもそのページが見える」というマルチテナントの自己サービス型に変わった。[[ADR-0001]]（バックエンドなし）・[[ADR-0002]]（localStorage集計）・[[ADR-0003]]（複製ベースのイベント追加）はいずれも「作成者本人の端末でしか見えない」「開発者がコードを編集して追加する」ことを前提にしており、この新要件を原理的に満たせない。
- Decision: Cloudflare Workers + D1（SQLite）+ Cloudflare Pages Functions を導入する。`events`／`event_logs`の2テーブルをD1に持ち、`POST /api/events`でイベントを作成すると公開URL（`/e/{eventId}/`）と秘密の管理用リンク（`/admin/{eventId}/{adminToken}/`）が発行される（質問箱型：ログイン不要、秘密リンクの所持が管理権限の証明）。既存のハードコードイベント`afterglow-2026-tokyo-day1`は`is_demo=1`のD1レコードとして移行し、特別扱いのコード分岐は作らない。分析ログ・集計ロジックは`analytics.js`から`src/lib/analytics.ts`（サーバー側、D1集計）に移した。新規イベントは`/create/`のフォームから作成し、`event-config.js`を手で編集する運用（ADR-0003）や`e/{eventId}/`フォルダの複製（README/AGENTS.md旧記載）はもう不要（任意のeventIdに対して`functions/e/[[eventId]].ts`が共通のHTMLシェルを返す）。
- Consequences: 「無ビルド・npm依存なし」（ADR-0001）の制約は撤廃し、TypeScript・Hono・zod・wranglerを導入した。ローカル開発には`wrangler pages dev .`とD1マイグレーション（`npm run migrate:local`）が必要になり、`python -m http.server`だけでは完結しなくなった。一方でなりすまし対策・モデレーション・イベント編集画面は今回意図的にスコープ外としており、今後の課題として残っている。
