/**
 * Vercel Serverless Function: 擷取 Google 文件內文 (含 CORS 支援)
 */

function extractDocInfo(inputUrl) {
  if (!inputUrl) return null;
  const trimmed = inputUrl.trim();
  const pubMatch = trimmed.match(/\/document\/d\/e\/([a-zA-Z0-9-_]+)/);
  if (pubMatch) return { id: pubMatch[1], isPub: true };
  const docMatch = trimmed.match(/\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/);
  if (docMatch) return { id: docMatch[1], isPub: false };
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return { id: trimmed, isPub: false };
  }
  return null;
}

module.exports = async function handler(req, res) {
  // 設定 CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = req.query.url || (req.body && req.body.url);
  if (!url) {
    return res.status(400).json({ success: false, error: '請提供 Google 文件網址 (url)' });
  }

  try {
    const info = extractDocInfo(url);
    if (!info) {
      return res.status(400).json({
        success: false,
        error: '無法識別此網址，請確認輸入的是標準 Google Docs 連結或文件 ID'
      });
    }

    const exportUrl = info.isPub
      ? `https://docs.google.com/document/d/e/${info.id}/pub?output=txt`
      : `https://docs.google.com/document/d/${info.id}/export?format=txt`;

    const response = await fetch(exportUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.url && (response.url.includes('accounts.google.com') || response.url.includes('ServiceLogin'))) {
      return res.status(403).json({
        success: false,
        error: '此 Google 文件需要登入或未公開共用權限。請在 Google 文件中點擊「共用」並設定為「知道連結的任何人均可查看」，或點選「檔案 ➜ 共用 ➜ 發布到網路」。'
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: `無法讀取文件 (HTTP ${response.status})。請確認文件 ID 是否正確且開啟檢視權限。`
      });
    }

    const text = await response.text();

    if (text.includes('<!DOCTYPE html>') && text.includes('accounts.google.com')) {
      return res.status(403).json({
        success: false,
        error: '此文件需登入檢視，請先將文件共用權限設為「知道連結的任何人均可查看」。'
      });
    }

    const cleanedText = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

    return res.status(200).json({
      success: true,
      docId: info.id,
      text: cleanedText
    });
  } catch (err) {
    console.error('Fetch Google Doc error:', err);
    return res.status(500).json({
      success: false,
      error: '擷取 Google 文件時發生錯誤: ' + (err.message || err.toString())
    });
  }
};
