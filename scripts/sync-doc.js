/**
 * CLI 腳本：讀取 Google 文件 (形容詞 / 名詞) 並推送到 GitHub
 * 
 * 預設 Google Docs：
 *   形容詞：https://docs.google.com/document/d/1VroI-PQY44U87PfjPRgaRX0Z-gFDiXgfl4oSPI14b5s/edit?usp=sharing
 *   名詞：  https://docs.google.com/document/d/1RSqBWOGG3jC5UcPZY-f81CII9cp8ppU6u-VYox4TDRM/edit?usp=sharing
 * 
 * 執行指令：
 *   npm run sync-doc
 * 或指定參數：
 *   node scripts/sync-doc.js --adj "<網址>" --noun "<網址>" --token "<ghp_...>"
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_ADJ_DOC = 'https://docs.google.com/document/d/1VroI-PQY44U87PfjPRgaRX0Z-gFDiXgfl4oSPI14b5s/edit?usp=sharing';
const DEFAULT_NOUN_DOC = 'https://docs.google.com/document/d/1RSqBWOGG3jC5UcPZY-f81CII9cp8ppU6u-VYox4TDRM/edit?usp=sharing';
const DEFAULT_REPO = 's411318-abc/auto-question-supply';
const DEFAULT_BRANCH = 'main';

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

async function pushToGitHub({ token, repo, filePath, branch, content, commitMessage }) {
  const [owner, repoName] = repo.split('/');
  if (!owner || !repoName) {
    throw new Error("儲存庫格式需為 '擁有者/專案名'，例如 s411318-abc/auto-question-supply");
  }

  const cleanPath = filePath.replace(/^\/+/, '');
  console.log(`🚀 正在推送至 GitHub: ${owner}/${repoName} [路徑: ${cleanPath}] ...`);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'AutoQuestionSupply-SyncScript'
  };

  // 1. 檢查檔案是否已存在以取得其 sha
  let sha = null;
  const getUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeURIComponent(cleanPath).replace(/%2F/g, '/')}?ref=${encodeURIComponent(branch)}`;
  const checkRes = await fetch(getUrl, { headers });

  if (checkRes.ok) {
    const fileInfo = await checkRes.json();
    sha = fileInfo.sha;
  } else if (checkRes.status !== 404) {
    const errData = await checkRes.json().catch(() => ({}));
    throw new Error(`查詢現有檔案資訊失敗 (HTTP ${checkRes.status}): ${errData.message || checkRes.statusText}`);
  }

  // 2. Base64 編碼文字內容
  const base64Content = Buffer.from(content, 'utf-8').toString('base64');

  // 3. 提交至 GitHub
  const putUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeURIComponent(cleanPath).replace(/%2F/g, '/')}`;
  const body = {
    message: commitMessage || `docs: 更新 ${cleanPath} (來自 Google 文件同步)`,
    content: base64Content,
    branch: branch || 'main'
  };
  if (sha) {
    body.sha = sha;
  }

  const putRes = await fetch(putUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body)
  });

  if (!putRes.ok) {
    const errData = await putRes.json().catch(() => ({}));
    throw new Error(`GitHub 提交失敗 (HTTP ${putRes.status}): ${errData.message || putRes.statusText}`);
  }

  return await putRes.json();
}

async function main() {
  const args = parseArgs();

  const token = args.token || process.env.GITHUB_TOKEN;
  const repo = args.repo || process.env.GITHUB_REPO || DEFAULT_REPO;
  const branch = args.branch || process.env.GITHUB_BRANCH || DEFAULT_BRANCH;

  const adjUrl = args.adj || process.env.GOOGLE_DOC_ADJ_URL || DEFAULT_ADJ_DOC;
  const nounUrl = args.noun || process.env.GOOGLE_DOC_NOUN_URL || DEFAULT_NOUN_DOC;
  const singleDocUrl = args.doc || process.env.GOOGLE_DOC_URL;

  console.log('==================================================');
  console.log(' 🚀 Auto Question Supply - Google Docs ➔ GitHub 同步');
  console.log('==================================================');

  try {
    if (singleDocUrl) {
      // 單一文件模式
      const content = await fetchGoogleDocText(singleDocUrl);
      const filePath = args.path || 'data/questions.txt';
      const result = await pushToGitHub({
        token,
        repo,
        filePath,
        branch,
        content,
        commitMessage: args.message || `docs: 更新 ${filePath} (來自 Google 文件)`
      });
      console.log(`\n🎉 單一文件推送完成！`);
      console.log(`🌐 檢視檔案: ${result.content.html_url}`);
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

      // 建立整合 vocabulary.json 與純文字檔
      const vocabData = {
        updatedAt: new Date().toISOString(),
        adjectives: adjWords,
        nouns: nounWords,
        sources: {
          adjectivesDoc: adjUrl,
          nounsDoc: nounUrl
        }
      };

      console.log('\n📦 正在將資料推送到 GitHub...');
      const vocabResult = await pushToGitHub({
        token,
        repo,
        filePath: 'data/vocabulary.json',
        branch,
        content: JSON.stringify(vocabData, null, 2),
        commitMessage: 'docs: 自動同步 Google 文件形容詞與名詞至 vocabulary.json'
      });

      console.log(`   ✅ 已同步 data/vocabulary.json`);
      console.log(`\n🎉 全部同步完成！`);
      console.log(`🔗 Commit: ${vocabResult.commit.sha.slice(0, 7)}`);
      console.log(`🌐 檢視 GitHub 檔案: ${vocabResult.content.html_url}`);
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
  pushToGitHub,
  extractDocInfo,
  extractWordsFromDocText
};
