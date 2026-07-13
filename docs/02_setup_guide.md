# 構築手順書 — 手作業で行うセットアップ

コードを動かす前に人の手で行う作業の手順。所要時間は全部で30〜60分程度。
すべて無料プラン・無料枠の範囲で完結する。

## 前提

- Googleアカウント(スプレッドシート・GASに使用)
- LINEアカウント(スマホ)

## 手順1: LINE公式アカウントとMessaging APIチャネルの作成

1. [LINE Developersコンソール](https://developers.line.biz/console/) にLINEアカウントでログイン
2. プロバイダーを新規作成(名前は任意。例: `家計簿`)
3. 「Messaging API」チャネルを作成
   - LINE公式アカウント作成画面に誘導されるので、アカウント名(例: `家計簿Bot`)を付けて作成
   - 料金プランは**コミュニケーションプラン(0円)** のままにする
4. [LINE Official Account Manager](https://manager.line.biz/) → 設定 → Messaging API で、作成したチャネルを有効化
5. LINE Developersコンソールでチャネルを開き、以下を控える:
   - **チャネルシークレット**(「チャネル基本設定」タブ)
   - **チャネルアクセストークン(長期)**(「Messaging API設定」タブで発行)
6. 「Messaging API設定」タブで以下を設定:
   - **応答メッセージ: オフ**(自動応答が邪魔になるため)
   - **あいさつメッセージ: オフ**(任意)
   - Webhook URLは後の手順6で設定するので今は空でよい
7. 同タブのQRコードから、自分のスマホでBotを友だち追加しておく

## 手順2: Gemini APIキーの取得

1. [Google AI Studio](https://aistudio.google.com/) にGoogleアカウントでログイン
2. 「Get API key」→「APIキーを作成」
3. 生成された **APIキー** を控える(クレジットカード登録は不要。無料枠のまま使う)

> 注意: 無料枠では入力データがGoogleのモデル改善に使われる可能性がある。
> 本システムがGeminiに送るのはレシート画像のみ(設計書8章)。

## 手順3: スプレッドシートの作成

1. [Googleスプレッドシート](https://sheets.new) で空のスプレッドシートを作成(名前は任意。例: `家計簿・資産管理`)
2. URLの `/d/` と `/edit` の間にある **スプレッドシートID** を控える

シートやヘッダー行を手で作る必要はない。後の手順5の `setup()` 実行で自動生成される。

## 手順4: GASプロジェクトの作成とコード配置

1. 手順3のスプレッドシートを開き、メニュー「拡張機能」→「Apps Script」でコンテナバインドのGASプロジェクトを作成
2. コードの配置は次のどちらかで行う:
   - **A. コピペ(簡単)**: このリポジトリの `src/` 配下の各 `.gs` ファイルを、GASエディタで同名のファイルを作って貼り付ける。`appsscript.json` はエディタの「プロジェクト設定」→「マニフェストを表示」を有効にして上書きする
   - **B. clasp(リポジトリと同期)**: ローカルで `npm i -g @google/clasp && clasp login && clasp clone <スクリプトID> --rootDir src` 後、`clasp push` で反映
3. GASエディタの「プロジェクト設定」→「スクリプト プロパティ」に以下の3つを登録する:

| プロパティ名 | 値 |
|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | 手順1-5のチャネルアクセストークン |
| `GEMINI_API_KEY` | 手順2のAPIキー |
| `SPREADSHEET_ID` | 手順3のスプレッドシートID |

## 手順5: 初期化の実行

1. GASエディタで `setup.gs` の `setup()` 関数を選択して実行
2. 初回は権限承認ダイアログが出るので許可する(自分のスプレッドシート・外部サービスへの接続)
3. スプレッドシートに `支出` `資産スナップショット` `資産マスタ` `カテゴリ` `設定` の各シートと初期データが生成されたことを確認
4. `資産マスタ` シートに自分の口座・資産を入力する(例: `〇〇銀行普通 / 現金預金 / 1 / TRUE`)
5. `カテゴリ` シートのキーワード列を自分がよく使う店名で育てる(後からいつでも追記可)

## 手順6: Webアプリと署名検証ゲートウェイのデプロイ

1. GASエディタ右上「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
   - 次のユーザーとして実行: **自分**
   - アクセスできるユーザー: **全員**(Workerからの匿名POSTを受けるため。共有鍵認証で保護される — 設計書8章)
2. 発行された **ウェブアプリURL**(`https://script.google.com/macros/s/…/exec`)を控える。このURLはLINEへ直接設定しない
3. Windowsのターミナルで次を実行し、64桁の共有鍵を生成する:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. 生成値をGASのスクリプトプロパティ`GATEWAY_SHARED_SECRET`へ保存する。チャット、GitHub、スクリーンショットへ貼らない
5. [Cloudflare](https://dash.cloudflare.com/sign-up)の無料アカウントを作成する。Workers Paidへの変更やカード登録は不要
6. リポジトリの`gateway/`で以下を実行する（PowerShellでは`npm.cmd` / `npx.cmd`を使用）:

   ```powershell
   npm.cmd install
   npx.cmd wrangler login
   npx.cmd wrangler secret put LINE_CHANNEL_SECRET
   npx.cmd wrangler secret put GAS_WEB_APP_URL
   npx.cmd wrangler secret put GATEWAY_SHARED_SECRET
   npx.cmd wrangler deploy
   ```

   - `LINE_CHANNEL_SECRET`: LINE Developersの「チャネル基本設定」にある値
   - `GAS_WEB_APP_URL`: 手順6-2で控えた`/exec` URL
   - `GATEWAY_SHARED_SECRET`: 手順6-3で生成し、GASへ設定したものと同じ値
   - 各値はCloudflareの暗号化Secretに保存され、ソースコードや`wrangler.jsonc`には書かれない

7. デプロイ結果の `https://assets-management-line-gateway.<サブドメイン>.workers.dev` URLを控える
8. LINE Developersコンソール →「Messaging API設定」→ Webhook URL にWorker URLを貼り付けて「検証」→ 成功を確認
9. **Webhookの利用: オン** にする
10. GASに残っている`LINE_CHANNEL_SECRET`スクリプトプロパティは削除する（Workerだけが保持する）

WorkerはWebhook本文（画像本体ではなくメッセージID等）をメモリ上で署名検証してGASへ転送するだけで、保存領域は使用しない。画像本体は従来どおりGASがLINEから直接取得する。

> コード更新時の注意: GASは「デプロイを管理」→ 既存デプロイの「編集」→ バージョン「新バージョン」で更新する。
> 「新しいデプロイ」を作るとURLが変わり、Webhook URLの再設定が必要になる。

> 移行時の注意: GASをゲートウェイ対応版へ更新してから、LINEのWebhook URLをWorkerへ切り替える。この間はBotが一時的に応答しない。問題があれば、GASを直前のバージョンへ戻してからWebhook URLを旧GAS URLへ戻す。

## 手順7: 動作確認

スマホのLINEからBotに送って確認する:

1. `ヘルプ` → 使い方が返ってくる
2. `テスト 100` → 「登録しました」+ `支出`シートに行が追加される
3. `取消` → 取り消され、シートの状態列が`取消`になる
4. レシート写真を送信 → 解析結果の確認メッセージ → `OK` → 登録される
5. `今月` → 集計が返ってくる
6. `資産` → 前回値の案内 → `〇〇銀行 1200000` と返信 → 登録される

## 手順8: 家族を追加する場合(任意)

1. 手順1-7のQRコードを家族に共有して友だち追加してもらう
2. 家族がBotを友だち追加すると、`設定`シートの配信先ユーザーIDに自動追記される
3. 自動登録は先着2人で停止する。2人のIDが登録されたことを確認し、BotのQRコードや検索情報を公開しない
4. 想定外のユーザーが先に登録された場合は、`設定`シートから該当IDの行を削除し、正しい家族に追加してもらう

## 手順9: 無料運用の上限と注意点

以下は2026年7月13日時点。各社の上限・料金は変更されることがあるため、リンク先の最新表示を優先する。

### Gemini API（レシート解析）

- `gemini-3.5-flash` のStandard APIはFree Tierで入力・出力トークンとも無料。ただしFree Tierでは、送信したレシート画像や出力がGoogleのサービス改善に使われる可能性がある
- 無料枠の正確なRPM（1分あたり）、TPM（トークン/分）、RPD（リクエスト/日）はプロジェクトやアカウント状態で変わる。固定値を手順書に書かず、[Google AI StudioのActive rate limits](https://aistudio.google.com/rate-limit)で `gemini-3.5-flash` の現在値を確認する
- このBotでは、レシート1枚につき通常1リクエスト。Gemini呼び出しが失敗した場合は1回だけ再試行するため、失敗時は最大2リクエストになる。テキスト支出登録・集計・資産登録ではGeminiを使わない。`testGeminiConnection()`の実行は1リクエスト
- 1日のレシート上限の目安は通常 `RPD` 枚。すべて再試行になった場合の安全側の目安は `RPD ÷ 2` 枚。RPDは米国太平洋時間の午前0時にリセットされる
- 独立した「月間リクエスト数」の固定枠は案内されていないため、理論上の月間目安は `RPD × その月の日数`。ただし実際にはRPM・TPMにも同時に制限され、上限値自体も変更されうる
- 上限に達すると課金へ自動移行するのではなく、Free Tierのままなら通常は `429 RESOURCE_EXHAUSTED` で停止する。連続再送せず、時間を置くか日次リセットを待つ

**意図しない課金を確実に避ける設定:**

1. このBot専用のGoogle AI Studioプロジェクトを使う
2. [Google AI Studio](https://aistudio.google.com/)でUsage Tierが **Free** であることを確認する
3. そのプロジェクトに請求先アカウントをリンクしない。カード登録やPaid Tierへのアップグレードを行わない
4. 将来Paid Tierを使う場合、Google Cloudの予算アラートは通知であり、利用額を自動停止するハード上限ではないことに注意する

参考: [Gemini料金](https://ai.google.dev/gemini-api/docs/pricing) / [Geminiレート制限](https://ai.google.dev/gemini-api/docs/rate-limits) / [Gemini請求](https://ai.google.dev/gemini-api/docs/billing)

### LINE Messaging API

- 日本のコミュニケーションプラン（無料）は、カウント対象メッセージが月200通まで
- このBotがユーザー操作へ返す**返信メッセージはカウント対象外**。テキスト登録、レシート解析結果、`今月`などを通常利用しても200通を消費しない
- 月次レポートはプッシュメッセージなのでカウント対象。現在の設計では `配信先ユーザー数 × 月1通`。家族4人なら月4通が目安
- LINE Official Account Managerからの一斉配信や、将来追加するプッシュ通知も同じ月間枠を消費する。上限到達後は追加課金されず送信エラーになるプランだが、有料プランへ変更しないこと
- 知らないユーザーIDが`設定`シートの配信先に入っていないか定期的に確認する

参考: [LINE Messaging API料金とカウント方法](https://developers.line.biz/en/docs/messaging-api/pricing/)

### Cloudflare Workers（署名検証ゲートウェイ）

- Workers Freeは1日100,000リクエストまで無料。このBotではLINE Webhook 1回につきWorker 1リクエストで、2人利用なら十分な余裕がある
- Paidプランへ変更しない。Free上限に達した場合はゲートウェイが一時停止し、追加課金ではなくBotが応答しなくなる
- Workerは画像本体を取得・保存しない。署名検証後、WebhookのJSONだけをGASへ転送する

参考: [Cloudflare Workers料金](https://developers.cloudflare.com/workers/platform/pricing/) / [Workers Free上限](https://developers.cloudflare.com/workers/platform/limits/)

### Google Apps Script

- 個人向けGoogleアカウントのURL Fetch上限は1日20,000回（Google Workspaceは1日100,000回）
- レシート1枚は通常、LINE画像取得・Gemini解析・LINE返信の約3回。Gemini再試行時は約4回。Apps Scriptだけを基準にすると約5,000枚/日以上だが、実際には先にGeminiのRPD/RPM制限へ達する可能性が高い
- URL Fetch上限は課金ではなく実行停止の制限。失敗状況はApps Scriptの「実行数」で確認する

参考: [Apps Scriptの割り当て](https://developers.google.com/apps-script/guides/services/quotas)

### 日常利用での注意

- レシートは1枚ずつ、文字が読める明るさ・角度で撮る。同じ画像を何度も連続送信しない
- レシートに氏名、住所、会員番号、カード情報など不要な個人情報が写る場合は、撮影前に隠すか画像を切り取る
- APIキー、LINEチャネルアクセストークン、チャネルシークレットはLINE・GitHub・スクリーンショットへ貼らない。漏えいした場合は直ちに再発行する
- 無料枠の確認先は、GeminiはGoogle AI Studio、LINEはLINE Official Account Manager、Apps Scriptは「実行数」。月初に一度確認すると安全

## トラブルシューティング

| 症状 | 確認ポイント |
|------|-------------|
| Webhook検証が失敗する | LINEのWebhook URLがGASではなく`workers.dev`のWorker URLになっているか |
| WorkerのWebhook検証が401になる | Workerの`LINE_CHANNEL_SECRET`がLINEチャネルの現在値と一致するか |
| WorkerからGASへ届かない | GASとWorkerの`GATEWAY_SHARED_SECRET`が完全一致するか。`GAS_WEB_APP_URL`が既存デプロイの`/exec` URLか |
| Botが無反応 | GASエディタの「実行数」ログでエラー確認。スクリプトプロパティ4つの綴り。LINE側「応答メッセージ」がオフか |
| コード更新が反映されない | 「新バージョン」でデプロイし直したか(上記注意参照) |
| レシート解析がエラーになる | `GEMINI_API_KEY` の値。無料枠のレート制限(数分おいて再試行) |
