# 歯科スタッフ配置システム — デプロイ手順

## ファイル構成
```
dental-scheduler/
├── index.html        ← フロントエンド（アプリ本体）
├── vercel.json       ← Vercel設定
├── api/
│   └── read-appt.js  ← APIキーを安全に保管するサーバー関数
└── README.md
```

---

## デプロイ手順（15分で完了）

### ① Anthropic APIキーを取得
1. https://console.anthropic.com にアクセス
2. アカウント作成 or ログイン
3. 左メニュー「API Keys」→「Create Key」
4. 表示されたキー（`sk-ant-...`）をコピーしてメモ

### ② GitHubにアップロード
1. https://github.com にログイン
2. 右上「＋」→「New repository」
3. Repository name: `dental-scheduler`（任意）
4. 「Create repository」をクリック
5. 「uploading an existing file」をクリック
6. このフォルダの中身（index.html, vercel.json, api/フォルダごと）をドラッグ＆ドロップ
7. 「Commit changes」をクリック

### ③ Vercelにデプロイ
1. https://vercel.com にログイン（GitHubアカウントで）
2. 「Add New Project」→ 上で作ったリポジトリを選択
3. 「Deploy」をクリック（設定変更不要）
4. デプロイ完了後、Settings → Environment Variables を開く
5. 「Add」をクリック：
   - Name: `ANTHROPIC_API_KEY`
   - Value: さっきコピーした `sk-ant-...` のキー
6. 「Save」→ Deployments タブから「Redeploy」

### ④ 完成！
- 表示されたURL（例：`https://dental-scheduler-xxx.vercel.app`）をスタッフに共有
- スマホ・PCどちらでもアクセス可能

---

## 注意事項
- APIキーは **絶対にindex.htmlに直接書かない**こと（api/read-appt.js経由で安全に管理）
- Anthropic APIは従量課金（画像1枚の読み取りで約1〜3円程度）
- Vercelの無料プランで十分動作します
