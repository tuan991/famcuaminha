// tools/flashcard-maker.js
class FlashcardMaker {
  constructor() {
    this.flashcards = JSON.parse(localStorage.getItem('flashcards') || '[]');
  }

  render() {
    return `
      <div class="tool-container">
        <h2>📝 Flashcard Maker</h2>
        <p>Tạo thẻ ghi nhớ để học tập hiệu quả</p>
        <div class="flashcard-input">
          <div class="input-group">
            <input type="text" id="fc-front" placeholder="Mặt trước (câu hỏi)">
            <input type="text" id="fc-back" placeholder="Mặt sau (câu trả lời)">
            <button id="fc-add" class="btn btn-primary">➕ Thêm thẻ</button>
          </div>
        </div>
        <div class="flashcard-list">
          ${this.flashcards.map((fc, idx) => `
            <div class="flashcard-item">
              <div class="fc-front">${fc.front}</div>
              <div class="fc-back hidden">${fc.back}</div>
              <button class="fc-flip" data-idx="${idx}">🔄 Lật</button>
              <button class="fc-delete" data-idx="${idx}">🗑️</button>
            </div>
          `).join('')}
        </div>
        <div class="flashcard-actions">
          <button id="fc-export" class="btn btn-secondary">📥 Xuất ra CSV</button>
          <button id="fc-import" class="btn btn-secondary">📤 Import CSV</button>
          <button id="fc-learn" class="btn btn-success">🎯 Học ngay</button>
        </div>
      </div>
    `;
  }

  initEvents() {
    document.getElementById('fc-add')?.addEventListener('click', () => {
      const front = document.getElementById('fc-front').value.trim();
      const back = document.getElementById('fc-back').value.trim();
      if (!front || !back) return alert('Vui lòng nhập đầy đủ');
      this.flashcards.push({ front, back, created: Date.now() });
      localStorage.setItem('flashcards', JSON.stringify(this.flashcards));
      location.reload();
    });

    document.querySelectorAll('.fc-flip').forEach(btn => {
      btn.addEventListener('click', () => {
        const parent = btn.closest('.flashcard-item');
        parent.querySelector('.fc-front').classList.toggle('hidden');
        parent.querySelector('.fc-back').classList.toggle('hidden');
      });
    });

    document.querySelectorAll('.fc-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        this.flashcards.splice(idx, 1);
        localStorage.setItem('flashcards', JSON.stringify(this.flashcards));
        location.reload();
      });
    });
  }
}