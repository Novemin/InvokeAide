// MSW スモークテスト(モック稼働確認用)
// 本テストは MSW handlers が起動していることを確認するだけで、
// 機能テストは Sさん / Uさん の実装後に追加される

import { describe, it, expect } from 'vitest';

describe('MSW スモークテスト', () => {
  it('Google Drive API モックが応答する', async () => {
    const res = await fetch('https://www.googleapis.com/drive/v3/files');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { files: unknown[] };
    expect(Array.isArray(body.files)).toBe(true);
  });

  it('Gemini API モックが応答する', async () => {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [] }),
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      candidates: { content: { parts: { text: string }[] } }[];
    };
    expect(body.candidates[0].content.parts[0].text).toContain('モック');
  });
});
