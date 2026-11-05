/**
 * 詞語隨機生成器
 * 核心邏輯腳本：支援不重複抽取、抽取池重置、詞庫保存、匯出匯入與批次管理
 */

// 狀態管理 (初始為空詞庫)
let state = {
  adjectives: [],
  nouns: [],
  drawnCombos: [], // 儲存已抽取的組合字串: "形容詞:::名詞"
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
  btnResetPool: document.getElementById("btnResetPool"),
  btnCopy: document.getElementById("btnCopy"),
  resultDisplay: document.getElementById("resultDisplay"),
  
  drawnProgressText: document.getElementById("drawnProgressText"),
  drawnPercentText: document.getElementById("drawnPercentText"),
  drawProgressBar: document.getElementById("drawProgressBar"),
  
  adjCountStat: document.getElementById("adjCountStat"),
  nounCountStat: document.getElementById("nounCountStat"),
  comboCountStat: document.getElementById("comboCountStat"),
  
  adjBadge: document.getElementById("adjBadge"),
  nounBadge: document.getElementById("nounBadge"),
  adjList: document.getElementById("adjList"),
  nounList: document.getElementById("nounList"),
  
  btnExportVocab: document.getElementById("btnExportVocab"),
  fileImportVocab: document.getElementById("fileImportVocab"),
  btnClearAll: document.getElementById("btnClearAll"),
  btnClearAdj: document.getElementById("btnClearAdj"),
  btnClearNoun: document.getElementById("btnClearNoun"),
  
  // 批次模態框
  btnOpenBatchModal: document.getElementById("btnOpenBatchModal"),
  batchModal: document.getElementById("batchModal"),
  btnCloseBatchModal: document.getElementById("btnCloseBatchModal"),
  btnCancelBatch: document.getElementById("btnCancelBatch"),
  btnConfirmBatch: document.getElementById("btnConfirmBatch"),
  batchAdjInput: document.getElementById("batchAdjInput"),
  batchNounInput: document.getElementById("batchNounInput"),
  
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
 * 從 LocalStorage 載入資料 (完全無預設詞彙，從零開始)
 */
function loadData() {
  try {
    // 遷移檢查：若瀏覽器先前有暫存舊的預設範例內容，在此進行重設清空
    const MIGRATION_KEY = "rw_defaults_cleared_v2";
    if (!localStorage.getItem(MIGRATION_KEY)) {
      localStorage.removeItem("rw_adjectives");
      localStorage.removeItem("rw_nouns");
      localStorage.removeItem("rw_drawnCombos");
      localStorage.setItem(MIGRATION_KEY, "true");
    }

    const savedAdj = localStorage.getItem("rw_adjectives");
    const savedNouns = localStorage.getItem("rw_nouns");
    const savedDrawn = localStorage.getItem("rw_drawnCombos");
    const savedHistory = localStorage.getItem("rw_history");

    state.adjectives = savedAdj ? (JSON.parse(savedAdj) || []) : [];
    state.nouns = savedNouns ? (JSON.parse(savedNouns) || []) : [];
    state.drawnCombos = savedDrawn ? (JSON.parse(savedDrawn) || []) : [];
    state.history = savedHistory ? (JSON.parse(savedHistory) || []) : [];

    // 清理無效組合
    cleanDrawnCombos();
    saveData();
  } catch (e) {
    console.error("載入本機資料失敗:", e);
    state.adjectives = [];
    state.nouns = [];
    state.drawnCombos = [];
  }
}

/**
 * 儲存資料至 LocalStorage (自動持久化保存)
 */
function saveData() {
  try {
    localStorage.setItem("rw_adjectives", JSON.stringify(state.adjectives));
    localStorage.setItem("rw_nouns", JSON.stringify(state.nouns));
    localStorage.setItem("rw_drawnCombos", JSON.stringify(state.drawnCombos));
    localStorage.setItem("rw_history", JSON.stringify(state.history));
  } catch (e) {
    console.error("儲存至本機資料失敗:", e);
  }
}

/**
 * 清理不存在於現有詞庫中的抽籤組合
 */
function cleanDrawnCombos() {
  const adjSet = new Set(state.adjectives);
  const nounSet = new Set(state.nouns);

  state.drawnCombos = state.drawnCombos.filter(combo => {
    const parts = combo.split(":::");
    return parts.length === 2 && adjSet.has(parts[0]) && nounSet.has(parts[1]);
  });
}

/**
 * 取得所有可能的組合池
 */
function getAllCombos() {
  const combos = [];
  for (let i = 0; i < state.adjectives.length; i++) {
    for (let j = 0; j < state.nouns.length; j++) {
      combos.push(`${state.adjectives[i]}:::${state.nouns[j]}`);
    }
  }
  return combos;
}

/**
 * 取得尚未被抽取的剩餘組合
 */
function getAvailableCombos() {
  const drawnSet = new Set(state.drawnCombos);
  const all = getAllCombos();
  return all.filter(combo => !drawnSet.has(combo));
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

  // 儲存表單事件
  elements.wordForm.addEventListener("submit", handleSaveWords);
  elements.btnSave.addEventListener("click", handleSaveWords);

  // 隨機抽取 (不重複)
  elements.btnGenerate.addEventListener("click", generateNonRepeatingCombination);

  // 重置抽選池按鈕
  elements.btnResetPool.addEventListener("click", resetDrawPool);

  // 複製結果按鈕
  elements.btnCopy.addEventListener("click", copyCurrentResult);

  // 匯出保存詞庫 (下載 JSON)
  elements.btnExportVocab.addEventListener("click", exportVocabulary);

  // 匯入詞庫 (載入 JSON)
  elements.fileImportVocab.addEventListener("change", importVocabulary);

  // 全部清空
  elements.btnClearAll.addEventListener("click", () => {
    if (confirm("確定要清空所有儲存的形容詞與名詞嗎？（已抽取的紀錄也會一併清空）")) {
      state.adjectives = [];
      state.nouns = [];
      state.drawnCombos = [];
      state.currentResult = "";
      saveData();
      renderAll();
      elements.resultDisplay.innerHTML = `( 請先於下方新增形容詞與名詞 )`;
      elements.resultDisplay.classList.add("placeholder");
      elements.btnCopy.disabled = true;
      showToast("已清空所有詞庫", "warning");
    }
  });

  elements.btnClearAdj.addEventListener("click", () => {
    if (state.adjectives.length === 0) return;
    if (confirm("確定要清空所有形容詞嗎？")) {
      state.adjectives = [];
      cleanDrawnCombos();
      saveData();
      renderAll();
      showToast("已清空形容詞清單", "warning");
    }
  });

  elements.btnClearNoun.addEventListener("click", () => {
    if (state.nouns.length === 0) return;
    if (confirm("確定要清空所有名詞嗎？")) {
      state.nouns = [];
      cleanDrawnCombos();
      saveData();
      renderAll();
      showToast("已清空名詞清單", "warning");
    }
  });

  // 批次輸入模態框事件
  elements.btnOpenBatchModal.addEventListener("click", () => {
    elements.batchAdjInput.value = "";
    elements.batchNounInput.value = "";
    elements.batchModal.style.display = "flex";
    elements.batchAdjInput.focus();
  });

  elements.btnCloseBatchModal.addEventListener("click", () => {
    elements.batchModal.style.display = "none";
  });

  elements.btnCancelBatch.addEventListener("click", () => {
    elements.batchModal.style.display = "none";
  });

  elements.btnConfirmBatch.addEventListener("handleConfirmBatch", handleConfirmBatch);
  elements.btnConfirmBatch.addEventListener("click", handleConfirmBatch);

  // 歷史紀錄清除
  elements.btnClearHistory.addEventListener("click", () => {
    state.history = [];
    saveData();
    renderHistory();
    showToast("已清除抽取紀錄", "warning");
  });
}

/**
 * 處理單筆新增與保存詞彙
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

  cleanDrawnCombos();
  saveData();
  renderAll();

  showToast(messages.join("、"), "success");

  if (!elements.adjInput.value && !elements.nounInput.value) {
    elements.adjInput.focus();
  }
}

/**
 * 批次儲存詞彙
 */
function handleConfirmBatch() {
  const adjText = elements.batchAdjInput.value.trim();
  const nounText = elements.batchNounInput.value.trim();

  if (!adjText && !nounText) {
    showToast("請至少填寫欲新增的形容詞或名詞！", "warning");
    return;
  }

  // 依換行、逗號、頓號、空白切分
  const splitRegex = /[\n\r,，、\s]+/;

  let addedAdj = 0;
  if (adjText) {
    const rawAdjs = adjText.split(splitRegex).filter(w => w.trim().length > 0);
    rawAdjs.forEach(word => {
      const cleanWord = word.trim();
      if (!state.adjectives.includes(cleanWord)) {
        state.adjectives.push(cleanWord);
        addedAdj++;
      }
    });
  }

  let addedNouns = 0;
  if (nounText) {
    const rawNouns = nounText.split(splitRegex).filter(w => w.trim().length > 0);
    rawNouns.forEach(word => {
      const cleanWord = word.trim();
      if (!state.nouns.includes(cleanWord)) {
        state.nouns.push(cleanWord);
        addedNouns++;
      }
    });
  }

  elements.batchModal.style.display = "none";
  cleanDrawnCombos();
  saveData();
  renderAll();

  showToast(`批次儲存成功！(新增 ${addedAdj} 個形容詞，${addedNouns} 個名詞)`, "success");
}

/**
 * 隨機抽取一個形容詞和一個名詞 (保證不重複抽取)
 */
function generateNonRepeatingCombination() {
  if (state.adjectives.length === 0 && state.nouns.length === 0) {
    showToast("目前沒有任何詞彙，請先新增形容詞與名詞！", "error");
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

  // 取得尚未被抽取的剩餘池
  const availableCombos = getAvailableCombos();

  // 若已經全數抽完
  if (availableCombos.length === 0) {
    showToast("🎉 所有組合已全部抽取完畢！請點擊「重置抽選池」即可重新開始新一輪抽取。", "warning");
    elements.resultDisplay.innerHTML = `<span style="font-size: 1.15rem; color: #f59e0b;">🎉 所有組合已全部抽完！請點擊上方「重置抽選池」重新開始</span>`;
    return;
  }

  // 隨機選取未抽過的組合
  const randomIndex = Math.floor(Math.random() * availableCombos.length);
  const chosenCombo = availableCombos[randomIndex];

  // 記錄已抽取
  state.drawnCombos.push(chosenCombo);

  // 解析出形容詞與名詞
  const [selectedAdj, selectedNoun] = chosenCombo.split(":::");

  // 組合格式: (形容詞 的 名詞)
  const formattedText = `(${selectedAdj} 的 ${selectedNoun})`;
  state.currentResult = formattedText;

  // 顯示於畫面上
  elements.resultDisplay.classList.remove("placeholder", "animate-pop");
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
  renderProgress();
  renderHistory();
}

/**
 * 重置抽選池 (清空已抽組合，保留詞庫)
 */
function resetDrawPool() {
  const totalCombos = state.adjectives.length * state.nouns.length;
  if (totalCombos === 0) {
    showToast("目前詞庫為空，請先新增詞彙！", "warning");
    return;
  }

  if (state.drawnCombos.length === 0) {
    showToast("目前抽選池已是全滿狀態，無需重置！", "warning");
    return;
  }

  state.drawnCombos = [];
  saveData();
  renderProgress();
  showToast(`已重置抽選池！全數 ${totalCombos} 種組合可重新不重複抽取。`, "success");
}

/**
 * 匯出並保存詞庫為 JSON 檔案
 */
function exportVocabulary() {
  if (state.adjectives.length === 0 && state.nouns.length === 0) {
    showToast("目前詞庫為空，無法匯出！", "warning");
    return;
  }

  const exportData = {
    appName: "auto-question-supply",
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    adjectives: state.adjectives,
    nouns: state.nouns
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
  const downloadAnchor = document.createElement("a");
  const fileName = `詞庫備份_${new Date().toISOString().slice(0, 10)}.json`;
  
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", fileName);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();

  showToast(`已成功匯出備份檔案：${fileName}`, "success");
}

/**
 * 匯入並載入詞庫檔案
 */
function importVocabulary(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const data = JSON.parse(event.target.result);
      if (!Array.isArray(data.adjectives) || !Array.isArray(data.nouns)) {
        throw new Error("檔案格式不符合規範");
      }

      // 合併詞彙
      let addedAdj = 0;
      let addedNoun = 0;

      data.adjectives.forEach(w => {
        if (typeof w === "string" && w.trim() && !state.adjectives.includes(w.trim())) {
          state.adjectives.push(w.trim());
          addedAdj++;
        }
      });

      data.nouns.forEach(w => {
        if (typeof w === "string" && w.trim() && !state.nouns.includes(w.trim())) {
          state.nouns.push(w.trim());
          addedNoun++;
        }
      });

      cleanDrawnCombos();
      saveData();
      renderAll();

      showToast(`匯入成功！新增 ${addedAdj} 個形容詞與 ${addedNoun} 個名詞`, "success");
    } catch (err) {
      console.error("匯入失敗:", err);
      showToast("匯入失敗，請確認是否為有效的詞庫 JSON 檔案！", "error");
    } finally {
      // 重置 input 以利重複選取同一檔案
      elements.fileImportVocab.value = "";
    }
  };

  reader.readAsText(file);
}

/**
 * 複製當前抽出的組合
 */
function copyCurrentResult() {
  if (!state.currentResult) return;

  navigator.clipboard.writeText(state.currentResult).then(() => {
    showToast(`已成功複製：${state.currentResult}`, "success");
  }).catch(() => {
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
  // 形容詞清單
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

  // 名詞清單
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

  elements.adjBadge.textContent = state.adjectives.length;
  elements.nounBadge.textContent = state.nouns.length;
}

/**
 * 渲染不重複抽取進度條與統計
 */
function renderProgress() {
  const totalCombos = state.adjectives.length * state.nouns.length;
  const drawnCount = state.drawnCombos.length;
  const remainingCount = Math.max(0, totalCombos - drawnCount);
  const percent = totalCombos > 0 ? Math.round((drawnCount / totalCombos) * 100) : 0;

  elements.drawnProgressText.textContent = `已抽 ${drawnCount} / ${totalCombos} 組 (剩餘 ${remainingCount} 組)`;
  elements.drawnPercentText.textContent = `${percent}%`;
  elements.drawProgressBar.style.width = `${percent}%`;

  if (percent === 100) {
    elements.drawProgressBar.style.background = "#10b981";
  } else {
    elements.drawProgressBar.style.background = "linear-gradient(90deg, #6366f1 0%, #10b981 100%)";
  }
}

/**
 * 渲染詞庫整體統計數據
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
  renderProgress();
  renderHistory();
}

/**
 * 移除單一詞彙
 */
function removeWord(type, index) {
  if (type === "adj") {
    const removed = state.adjectives.splice(index, 1)[0];
    cleanDrawnCombos();
    saveData();
    renderAll();
    showToast(`已刪除形容詞「${removed}」`, "warning");
  } else if (type === "noun") {
    const removed = state.nouns.splice(index, 1)[0];
    cleanDrawnCombos();
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
  }, 3200);
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
