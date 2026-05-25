// OAuth 認証ヘルパー
// credentials.json を読み込み、 access token を取得した OAuth2 クライアントを返す
// 検証用専用、 ベータ実装の AuthProvider (B2、 Uさん 実装) とは別物

import { google } from 'googleapis';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = resolve(__dirname, '..', 'credentials.json');

async function loadCredentials() {
  let text;
  try {
    text = await readFile(CREDENTIALS_PATH, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(
        `credentials.json が見つかりません(${CREDENTIALS_PATH})。 README.md §credentials の準備 を参照して作成してください。`,
      );
    }
    throw err;
  }
  const json = JSON.parse(text);
  for (const key of ['client_id', 'client_secret', 'refresh_token']) {
    if (!json[key] || String(json[key]).startsWith('YOUR_')) {
      throw new Error(`credentials.json の ${key} が未設定 or template のままです。`);
    }
  }
  return json;
}

export async function getOAuth2Client() {
  const creds = await loadCredentials();
  const oauth2 = new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
    creds.redirect_uri || 'http://localhost',
  );
  oauth2.setCredentials({ refresh_token: creds.refresh_token });
  // refresh_token を使って access_token を取得(初回呼び出しで自動取得)
  const { token } = await oauth2.getAccessToken();
  if (!token) {
    throw new Error('access_token の取得に失敗しました。 refresh_token を再発行してください。');
  }
  return oauth2;
}

export async function getTasksClient() {
  const auth = await getOAuth2Client();
  return google.tasks({ version: 'v1', auth });
}

export async function getCalendarClient() {
  const auth = await getOAuth2Client();
  return google.calendar({ version: 'v3', auth });
}
