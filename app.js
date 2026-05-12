const sourceText = document.getElementById('sourceText');
const reader = document.getElementById('reader');
const wordList = document.getElementById('wordList');
const loadSample = document.getElementById('loadSample');
const exportWords = document.getElementById('exportWords');

const STORAGE_KEY = 'auto-vocab-reader';

const sampleText = `This is a demo article for automatic vocabulary collection.\n\nWhile reading, the page highlights each word and builds a word list automatically.\nClick any word to mark it as learned, and export the vocabulary list for review later.`;

const translateWord = async (word) => {
  try {
    const response = await fetch(`http://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|zh-CN`);
    const data = await response.json();
    return data.responseData.translatedText;
  } catch (e) {
    return '翻譯失敗';
  }
};

const parseWords = (text) => {
  const matches = text.toLowerCase().match(/\b[a-zA-Z']{2,}\b/g) || [];
  const map = new Map();
  matches.forEach((raw) => {
    const word = raw.replace(/^'+|'+$/g, '');
    if (!word) return;
    const count = map.get(word) || 0;
    map.set(word, count + 1);
  });
  return map;
};

const buildState = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return { learned: [], text: '' };
  try {
    return JSON.parse(saved);
  } catch {
    return { learned: [], text: '' };
  }
};

const state = buildState();

const saveState = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ learned: Array.from(state.learned), text: sourceText.value }));
};

const toggleLearned = (word) => {
  if (state.learned.has(word)) {
    state.learned.delete(word);
  } else {
    state.learned.add(word);
  }
  saveState();
  render();
};

const renderReader = (text, knownWords) => {
  const escaped = safeHtml(text);
  const html = escaped.replace(/\b([a-zA-Z']{2,})\b/g, (match) => {
    const key = match.toLowerCase();
    const className = knownWords.has(key) ? 'word learned' : 'word';
    return `<span class="${className}" data-word="${key}">${match}</span>`;
  });
  reader.innerHTML = html;
};

const renderWordList = (wordMap, knownWords) => {
  if (wordMap.size === 0) {
    wordList.innerHTML = '<p>文章中還沒有可收集的單字。請貼上英文文章開始。</p>';
    return;
  }
  const items = Array.from(wordMap.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([word, count]) => {
      const learned = knownWords.has(word);
      return `
      <div class="word-item${learned ? ' learned' : ''}" data-word="${word}">
        <div class="word-label">
          <strong>${word}</strong>
          <span class="word-meta">出現次數：${count}</span>
        </div>
        <div class="word-translation">
          <button class="translate-btn" data-word="${word}">翻譯</button>
          <span class="translation-text" id="trans-${word}"></span>
        </div>
        ${learned ? '<span class="learned-chip">已學過</span>' : '<span class="learned-chip">待學習</span>'}
      </div>`;
    });
  wordList.innerHTML = items.join('');
};

const render = () => {
  const text = sourceText.value.trim();
  const wordMap = parseWords(text);
  renderReader(text, state.learned);
  renderWordList(wordMap, state.learned);
};

sourceText.addEventListener('input', () => {
  state.text = sourceText.value;
  saveState();
  render();
});

reader.addEventListener('click', (event) => {
  const target = event.target.closest('.word');
  if (target && target.dataset.word) {
    toggleLearned(target.dataset.word);
  }
});

wordList.addEventListener('click', async (event) => {
  const target = event.target.closest('.word-item');
  if (target && target.dataset.word) {
    toggleLearned(target.dataset.word);
  }
  const translateBtn = event.target.closest('.translate-btn');
  if (translateBtn) {
    const word = translateBtn.dataset.word;
    const transElement = document.getElementById(`trans-${word}`);
    if (transElement.textContent) return; // 已翻譯過
    transElement.textContent = '翻譯中...';
    const translation = await translateWord(word);
    transElement.textContent = translation;
  }
});

loadSample.addEventListener('click', () => {
  sourceText.value = sampleText;
  state.text = sampleText;
  saveState();
  render();
});

exportWords.addEventListener('click', () => {
  const wordMap = parseWords(sourceText.value);
  if (wordMap.size === 0) {
    alert('請先貼入文章，才能匯出單字清單。');
    return;
  }
  const lines = Array.from(wordMap.keys()).sort((a, b) => a.localeCompare(b));
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'vocabulary.txt';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

sourceText.value = state.text;
state.learned = new Set(state.learned || []);
render();
