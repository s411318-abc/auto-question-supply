/**
 * 詞語隨機生成器
 * 核心邏輯腳本
 */

// 預設精選詞庫
const SAMPLE_ADJECTIVES = [
  "快樂", "神秘", "巨大", "溫暖", "優雅", 
  "勇敢", "閃耀", "懶散", "美味", "天馬行空"
];

const SAMPLE_NOUNS = [
  "貓咪", "工程師", "珍珠奶茶", "宇宙飛船", "吉他", 
  "咖啡豆", "魔法師", "向日葵", "機器人", "演算法"
];

// 狀態管理
let state = {
  adjectives: [],
  nouns: [],
  history: [],
  currentResult: ""
};

// DOM 元素引用
const elements = {
  adjInput: document.getElementById("adjInput"),
  nounInput: document.getElementById("nounInput"),
  clearAdjInput: document.getElementById("clearAdjInput"),
  clearNounInput: document.getElementById("clearNounInput"),
  btnSave: document.getElementById("btnSave"),
  wordForm: document.getElementById("wordForm"),
  
  btnGenerate: document.getElementById("btnGenerate"),
  btnCopy: document.getElementById("btnCopy"),
  resultDisplay: document.getElementById("resultDisplay"),
  
  adjCountStat: document.getElementById("adjCountStat"),
  nounCountStat: document.getElementById("nounCountStat"),
  comboCountStat: document.getElementById("comboCountStat"),
  
  adjBadge: document.getElementById("adjBadge"),
  nounBadge: document.getElementById("nounBadge"),
  adjList: document.getElementById("adjList"),
  nounList: document.getElementById("nounList"),
  
  btnLoadSample: document.getElementById("btnLoadSample"),
  btnClearAll: document.getElementById("btnClearAll"),
  btnClearAdj: document.getElementById("btnClearAdj"),
  btnClearNoun: document.getElementById("btnClearNoun"),
  
  historySection: document.getElementById("historySection"),
  historyList: document.getElementById("historyList"),
  btnClearHistory: document.getElementById("btnClearHistory"),
  
  toastContainer: document.getElementById("toastContainer")
};

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  setupEventListeners();
  renderAll();
});

/**
 * 從 LocalStorage 載入資料
 */
function loadData() {
  try {
    const savedAdj = localStorage.getItem("rw_adjectives");
    const savedNouns = localStorage.getItem("rw_nouns");
    const savedHistory = localStorage.getItem("rw_history");

    if (savedAdj !== null && savedNouns !== null) {
      state.adjectives = JSON.parse(savedAdj) || [];
      state.nouns = JSON.parse(savedNouns) || [];
    } else {
      // 首次進入載入範例資料，讓使用者可直接體驗
      state.adjectives = [...SAMPLE_ADJECTIVES];
      state.nouns = [...SAMPLE_NOUNS];
      saveData();
    }

    if (savedHistory) {
      state.history = JSON.parse(savedHistory) || [];
    }
  } catch (e) {
    console.error("載入本機資料失敗:", e);
    state.adjectives = [...SAMPLE_ADJECTIVES];
    state.nouns = [...SAMPLE_NOUNS];
  }
}

/**
 * 儲存資料至 LocalStorage
 */
function saveData() {
  try {
    localStorage.setItem("rw_adjectives", JSON.stringify(state.adjectives));
    localStorage.setItem("rw_nouns", JSON.stringify(state.nouns));
    localStorage.setItem("rw_history", JSON.stringify(state.history));
  } catch (e) {
    console.error("儲存至本機資料失敗:", e);
  }
}

/**
 * 註冊事件監聽器
 */
function setupEventListeners() {
  // 輸入欄清除按鈕控制
  elements.adjInput.addEventListener("input", () => {
    elements.clearAdjInput.style.display = elements.adjInput.value ? "block" : "none";
  });
  elements.nounInput.addEventListener("input", () => {
    elements.clearNounInput.style.display = elements.nounInput.value ? "block" : "none";
  });

  elements.clearAdjInput.addEventListener("click", () => {
    elements.adjInput.value = "";
    elements.clearAdjInput.style.display = "none";
    elements.adjInput.focus();
  });

  elements.clearNounInput.addEventListener("click", () => {
    elements.nounInput.value = "";
    elements.clearNounInput.style.display = "none";
    elements.nounInput.focus();
  });

  // 儲存表單事件 (按 Enter 或點擊按鈕)
  elements.wordForm.addEventListener("submit", handleSaveWords);
  elements.btnSave.addEventListener("click", handleSaveWords);

  // 隨機生成事件
  elements.btnGenerate.addEventListener("click", generateCombination);

  // 複製結果事件
  elements.btnCopy.addEventListener("click", copyCurrentResult);

  // 詞庫工具按鈕
  elements.btnLoadSample.addEventListener("click", () => {
    // 合併範例（避免重複）
    let addedAdjCount = 0;
    let addedNounCount = 0;

    SAMPLE_ADJECTIVES.forEach(word => {
      if (!state.adjectives.includes(word)) {
        state.adjectives.push(word);
        addedAdjCount++;
      }
    });

    SAMPLE_NOUNS.forEach(word => {
      if (!state.nouns.includes(word)) {
        state.nouns.push(word);
        addedNounCount++;
      }
    });

    saveData();
    renderAll();
    showToast(`已載入精選範例！(新增 ${addedAdjCount} 個形容詞，${addedNounCount} 個名詞)`, "success");
  });

  elements.btnClearAll.addEventListener("click", () => {
    if (confirm("確定要清空所有儲存的形容詞與名詞嗎？")) {
      state.adjectives = [];
      state.nouns = [];
      saveData();
      renderAll();
      showToast("已清空所有詞庫", "warning");
    }
  });

  elements.btnClearAdj.addEventListener("click", () => {
    if (state.adjectives.length === 0) return;
    if (confirm("確定要清空所有形容詞嗎？")) {
      state.adjectives = [];
      saveData();
      renderAll();
      showToast("已清空形容詞清單", "warning");
    }
  });

  elements.btnClearNoun.addEventListener("click", () => {
    if (state.nouns.length === 0) return;
    if (confirm("確定要清空所有名詞嗎？")) {
      state.nouns = [];
      saveData();
      renderAll();
      showToast("已清空名詞清單", "warning");
    }
  });

  elements.btnClearHistory.addEventListener("click", () => {
    state.history = [];
    saveData();
    renderHistory();
    showToast("已清除抽取紀錄", "warning");
  });
}

/**
 * 處理新增與儲存詞彙
 */
function handleSaveWords(e) {
  if (e) e.preventDefault();

  const rawAdj = elements.adjInput.value.trim();
  const rawNoun = elements.nounInput.value.trim();

  if (!rawAdj && !rawNoun) {
    showToast("請至少填寫一個形容詞或名詞！", "warning");
    elements.adjInput.focus();
    return;
  }

  let messages = [];

  // 處理形容詞
  if (rawAdj) {
    if (state.adjectives.includes(rawAdj)) {
      messages.push(`形容詞「${rawAdj}」已存在`);
    } else {
      state.adjectives.push(rawAdj);
      messages.push(`已儲存形容詞「${rawAdj}」`);
      elements.adjInput.value = "";
      elements.clearAdjInput.style.display = "none";
    }
  }

  // 處理名詞
  if (rawNoun) {
    if (state.nouns.includes(rawNoun)) {
      messages.push(`名詞「${rawNoun}」已存在`);
    } else {
      state.nouns.push(rawNoun);
      messages.push(`已儲存名詞「${rawNoun}」`);
      elements.nounInput.value = "";
      elements.clearNounInput.style.display = "none";
    }
  }

  saveData();
  renderAll();

  // 顯示提示訊息
  showToast(messages.join("、"), "success");

  // 回到適當的輸入焦點
  if (!elements.adjInput.value && !elements.nounInput.value) {
    elements.adjInput.focus();
  }
}

/**
 * 隨機抽取一個形容詞和一個名詞並組合成 "(形容詞 的 名詞)"
 */
function generateCombination() {
  if (state.adjectives.length === 0 && state.nouns.length === 0) {
    showToast("詞庫是空的，請先新增形容詞與名詞！", "error");
    elements.adjInput.focus();
    return;
  }

  if (state.adjectives.length === 0) {
    showToast("缺少形容詞，請先新增至少一個形容詞！", "warning");
    elements.adjInput.focus();
    return;
  }

  if (state.nouns.length === 0) {
    showToast("缺少名詞，請先新增至少一個名詞！", "warning");
    elements.nounInput.focus();
    return;
  }

  // 隨機選取
  const randomAdjIndex = Math.floor(Math.random() * state.adjectives.length);
  const randomNounIndex = Math.floor(Math.random() * state.nouns.length);

  const selectedAdj = state.adjectives[randomAdjIndex];
  const selectedNoun = state.nouns[randomNounIndex];

  // 組合格式: (形容詞 的 名詞)
  const formattedText = `(${selectedAdj} 的 ${selectedNoun})`;
  state.currentResult = formattedText;

  // 顯示於畫面上（美化標籤渲染）
  elements.resultDisplay.classList.remove("placeholder", "animate-pop");
  // 強制重繪觸發動畫
  void elements.resultDisplay.offsetWidth;
  elements.resultDisplay.classList.add("animate-pop");

  elements.resultDisplay.innerHTML = `
    <span>(</span>
    <span class="result-adj">${escapeHtml(selectedAdj)}</span>
    <span class="result-connector">的</span>
    <span class="result-noun">${escapeHtml(selectedNoun)}</span>
    <span>)</span>
  `;

  // 啟用複製按鈕
  elements.btnCopy.disabled = false;

  // 加入歷史紀錄 (最多保存 15 筆)
  state.history.unshift({
    text: formattedText,
    adj: selectedAdj,
    noun: selectedNoun,
    time: new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  });

  if (state.history.length > 15) {
    state.history.pop();
  }

  saveData();
  renderHistory();
}

/**
 * 複製當前抽出的組合
 */
function copyCurrentResult() {
  if (!state.currentResult) return;

  navigator.clipboard.writeText(state.currentResult).then(() => {
    showToast(`已成功複製：${state.currentResult}`, "success");
  }).catch(() => {
    // 備援剪貼簿方案
    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = state.currentResult;
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    document.execCommand("copy");
    document.body.removeChild(tempTextArea);
    showToast(`已成功複製：${state.currentResult}`, "success");
  });
}

/**
 * 渲染詞庫標籤
 */
function renderWords() {
  // 渲染形容詞
  elements.adjList.innerHTML = "";
  if (state.adjectives.length === 0) {
    elements.adjList.innerHTML = `<span class="empty-pool-msg">暫無形容詞，請於上方新增</span>`;
  } else {
    state.adjectives.forEach((word, index) => {
      const tag = document.createElement("div");
      tag.className = "word-tag tag-adj";
      tag.innerHTML = `
        <span>${escapeHtml(word)}</span>
        <button type="button" class="tag-remove" title="刪除此詞">&times;</button>
      `;
      tag.querySelector(".tag-remove").addEventListener("click", () => {
        removeWord("adj", index);
      });
      elements.adjList.appendChild(tag);
    });
  }

  // 渲染名詞
  elements.nounList.innerHTML = "";
  if (state.nouns.length === 0) {
    elements.nounList.innerHTML = `<span class="empty-pool-msg">暫無名詞，請於上方新增</span>`;
  } else {
    state.nouns.forEach((word, index) => {
      const tag = document.createElement("div");
      tag.className = "word-tag tag-noun";
      tag.innerHTML = `
        <span>${escapeHtml(word)}</span>
        <button type="button" class="tag-remove" title="刪除此詞">&times;</button>
      `;
      tag.querySelector(".tag-remove").addEventListener("click", () => {
        removeWord("noun", index);
      });
      elements.nounList.appendChild(tag);
    });
  }

  // 更新徽章計數
  elements.adjBadge.textContent = state.adjectives.length;
  elements.nounBadge.textContent = state.nouns.length;
}

/**
 * 渲染統計數據
 */
function renderStats() {
  const adjCount = state.adjectives.length;
  const nounCount = state.nouns.length;
  const combos = adjCount * nounCount;

  elements.adjCountStat.textContent = adjCount;
  elements.nounCountStat.textContent = nounCount;
  elements.comboCountStat.textContent = combos.toLocaleString();
}

/**
 * 渲染歷史紀錄
 */
function renderHistory() {
  if (state.history.length === 0) {
    elements.historySection.style.display = "none";
    elements.historyList.innerHTML = "";
    return;
  }

  elements.historySection.style.display = "block";
  elements.historyList.innerHTML = "";

  state.history.forEach(item => {
    const chip = document.createElement("div");
    chip.className = "history-chip";
    chip.title = `於 ${item.time} 抽取，點擊可複製`;
    chip.textContent = item.text;
    chip.addEventListener("click", () => {
      navigator.clipboard.writeText(item.text);
      showToast(`已複製歷史紀錄：${item.text}`, "success");
    });
    elements.historyList.appendChild(chip);
  });
}

/**
 * 完整重新渲染視圖
 */
function renderAll() {
  renderWords();
  renderStats();
  renderHistory();
}

/**
 * 移除單一詞彙
 */
function removeWord(type, index) {
  if (type === "adj") {
    const removed = state.adjectives.splice(index, 1)[0];
    saveData();
    renderAll();
    showToast(`已刪除形容詞「${removed}」`, "warning");
  } else if (type === "noun") {
    const removed = state.nouns.splice(index, 1)[0];
    saveData();
    renderAll();
    showToast(`已刪除名詞「${removed}」`, "warning");
  }
}

/**
 * 彈出式訊息通知 (Toast)
 */
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let icon = "✅";
  if (type === "warning") icon = "⚠️";
  if (type === "error") icon = "❌";

  toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3000);
}

/**
 * HTML 特殊字元跳脫保護
 */
function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

