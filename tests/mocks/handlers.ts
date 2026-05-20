// MSW モック handlers
// テスト時に Google API / Gemini / VOICEVOX Cloud Run のレスポンスを偽装する
// 本格的なフィクスチャは Sさん / Uさん の実装が進んだ段階で追加される

import { http, HttpResponse } from 'msw';

export const handlers = [
  // Google Drive API
  http.get('https://www.googleapis.com/drive/v3/files', () =>
    HttpResponse.json({
      kind: 'drive#fileList',
      files: [],
    }),
  ),

  http.post('https://www.googleapis.com/drive/v3/files', () =>
    HttpResponse.json({
      kind: 'drive#file',
      id: 'mock-file-id',
      name: 'mock-file',
      mimeType: 'application/vnd.google-apps.folder',
    }),
  ),

  // Google Tasks API(動的 listId のため regex)
  http.get(/tasks\.googleapis\.com\/tasks\/v1\/lists\/[^/]+\/tasks/, () =>
    HttpResponse.json({
      kind: 'tasks#tasks',
      items: [],
    }),
  ),

  // Google Calendar API(動的 calendarId のため regex)
  http.post(/www\.googleapis\.com\/calendar\/v3\/calendars\/[^/]+\/events/, () =>
    HttpResponse.json({
      kind: 'calendar#event',
      id: 'mock-event-id',
      summary: 'MIYU - タスク見直しの時間',
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
      extendedProperties: { private: { miyu_kind: 'coaching_notification' } },
    }),
  ),

  // Gemini API(:generateContent サフィックスのため regex 必須、 msw 2.x の path-to-regexp 制約)
  http.post(/generativelanguage\.googleapis\.com\/v1beta\/models\/.+:generateContent/, () =>
    HttpResponse.json({
      candidates: [
        {
          content: { parts: [{ text: 'モック応答(MSW)' }], role: 'model' },
          finishReason: 'STOP',
        },
      ],
    }),
  ),

  // VOICEVOX Cloud Run(動的ホスト名のため regex)
  http.post(/voicevox-engine-.+\.run\.app\/audio_query/, () => HttpResponse.json({})),
  http.post(/voicevox-engine-.+\.run\.app\/synthesis/, () =>
    HttpResponse.arrayBuffer(new ArrayBuffer(0), {
      headers: { 'Content-Type': 'audio/wav' },
    }),
  ),
];
