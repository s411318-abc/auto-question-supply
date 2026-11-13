/**
 * CLI 腳本：讀取 Google 文件 (形容詞 / 名詞) 並同步至本機詞庫檔案
 * 
 * 預設 Google Docs：
 *   形容詞：https://docs.google.com/document/d/1VroI-PQY44U87PfjPRgaRX0Z-gFDiXgfl4oSPI14b5s/edit?usp=sharing
 *   名詞：  https://docs.google.com/document/d/1RSqBWOGG3jC5UcPZY-f81CII9cp8ppU6u-VYox4TDRM/edit?usp=sharing
 * 
 * 執行指令：
 *   npm run sync-doc
 * 或指定參數：
 *   node scripts/sync-doc.js --adj "<網址>" --noun "<網址>"
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_ADJ_DOC = 'https://docs.google.com/document/d/1VroI-PQY44U87PfjPRgaRX0Z-gFDiXgfl4oSPI14b5s/edit?usp=sharing';
const DEFAULT_NOUN_DOC = 'https://docs.google.com/document/d/1RSqBWOGG3jC5UcPZY-f81CII9cp8ppU6u-VYox4TDRM/edit?usp=sharing';

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        params[key] = next;
        i++;
      } else {
        params[key] = true;
      }
    }
  }
  return params;
}

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

async function fetchGoogleDocText(docUrl) {
  const info = extractDocInfo(docUrl);
  if (!info) {
    throw new Error(`無法辨識 Google 文件網址: ${docUrl}`);
  }

  const exportUrl = info.isPub
    ? `https://docs.google.com/document/d/e/${info.id}/pub?output=txt`
    : `https://docs.google.com/document/d/${info.id}/export?format=txt`;

  console.log(`📡 正在讀取 Google 文件 [ID: ${info.id}] ...`);

  const response = await fetch(exportUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (response.url && (response.url.includes('accounts.google.com') || response.url.includes('ServiceLogin'))) {
    throw new Error('此 Google 文件需要登入或未公開共用權限。請在 Google 文件中點擊「共用」並設定為「知道連結的任何人均可查看」。');
  }

  if (!response.ok) {
    throw new Error(`無法擷取 Google 文件內容 (HTTP ${response.status})。請確認文件 ID 是否正確且開啟檢視權限。`);
  }

  const text = await response.text();
  if (text.includes('<!DOCTYPE html>') && text.includes('accounts.google.com')) {
    throw new Error('此 Google 文件需要登入檢視，請將共用設定調整為「知道連結的任何人均可查看」。');
  }

  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
}

function extractWordsFromDocText(text) {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const words = [];
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    line = line.replace(/^[\d+]+[\.\、\)\-\s]+/, '').replace(/^[\-\*\•]\s+/, '').trim();
    if (!line) continue;
    const tokens = line.split(/[,，、;\t\s]+/).map(t => t.trim()).filter(Boolean);
    for (const t of tokens) {
      if (t && !words.includes(t)) {
        words.push(t);
      }
    }
  }
  return words;
}

async function main() {
  const args = parseArgs();

  const adjUrl = args.adj || process.env.GOOGLE_DOC_ADJ_URL || DEFAULT_ADJ_DOC;
  const nounUrl = args.noun || process.env.GOOGLE_DOC_NOUN_URL || DEFAULT_NOUN_DOC;
  const singleDocUrl = args.doc || process.env.GOOGLE_DOC_URL;

  console.log('==================================================');
  console.log(' 📄 Auto Question Supply - Google Docs 同步');
  console.log('==================================================');

  try {
    if (singleDocUrl) {
      // 單一文件模式
      const content = await fetchGoogleDocText(singleDocUrl);
      const filePath = path.resolve(__dirname, '..', args.path || 'data/questions.txt');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`\n🎉 單一文件儲存完成！已儲存至: ${filePath}`);
    } else {
      // 雙文件模式 (形容詞 & 名詞)
      console.log(`[1/2] 讀取形容詞文件: ${adjUrl}`);
      const adjText = await fetchGoogleDocText(adjUrl);
      const adjWords = extractWordsFromDocText(adjText);
      console.log(`   ➔ 形容詞共讀取 ${adjWords.length} 個詞彙 (原始字元數: ${adjText.length})`);

      console.log(`[2/2] 讀取名詞文件: ${nounUrl}`);
      const nounText = await fetchGoogleDocText(nounUrl);
      const nounWords = extractWordsFromDocText(nounText);
      console.log(`   ➔ 名詞共讀取 ${nounWords.length} 個詞彙 (原始字元數: ${nounText.length})`);

      // 建立整合 vocabulary.json
      const vocabData = {
        updatedAt: new Date().toISOString(),
        adjectives: adjWords,
        nouns: nounWords,
        sources: {
          adjectivesDoc: adjUrl,
          nounsDoc: nounUrl
        }
      };

      const outputPath = path.resolve(__dirname, '../data/vocabulary.json');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(vocabData, null, 2), 'utf-8');

      console.log(`\n🎉 全部同步完成！已更新本機詞庫: ${outputPath}`);
    }
  } catch (err) {
    console.error(`\n❌ 執行失敗: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  fetchGoogleDocText,
  extractDocInfo,
  extractWordsFromDocText
};
