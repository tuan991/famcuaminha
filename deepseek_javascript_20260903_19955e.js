// tools/tool-chain.js
class ToolChainBuilder {
  constructor() {
    this.chain = [];
    this.results = [];
    this.container = document.getElementById('chain-builder');
  }

  render() {
    this.container.innerHTML = `
      <div class="chain-header">
        <h3>⚡ Tool Chain Builder</h3>
        <p class="chain-desc">Ghép nhiều công cụ thành một quy trình tự động</p>
      </div>
      <div class="chain-workspace">
        <div class="chain-tools-palette">
          <h4>📦 Công cụ có sẵn</h4>
          <div class="palette-grid">
            ${this.getAvailableTools().map(t => `
              <div class="palette-tool" draggable="true" data-tool-id="${t.id}">
                <i class="fas ${t.icon}"></i>
                <span>${t.name}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="chain-drop-area" id="chain-drop-area">
          <p class="drop-hint">Kéo thả công cụ vào đây để tạo chuỗi</p>
          <div id="chain-steps" class="chain-steps"></div>
          <div class="chain-actions">
            <button class="btn btn-run-chain" id="run-chain">▶ Chạy chuỗi</button>
            <button class="btn btn-save-chain" id="save-chain">💾 Lưu chuỗi</button>
            <button class="btn btn-clear-chain" id="clear-chain">🗑️ Xóa chuỗi</button>
          </div>
        </div>
      </div>
      <div id="chain-result" class="chain-result hidden"></div>
    `;
    this.initDragDrop();
    this.initButtons();
  }

  getAvailableTools() {
    // Lấy danh sách tool từ config
    return window.APP_TOOLS || [
      { id: 'json-formatter', name: 'Format JSON', icon: 'fa-brackets-curly' },
      { id: 'csv-to-json', name: 'CSV → JSON', icon: 'fa-code' },
      { id: 'image-compress', name: 'Nén ảnh', icon: 'fa-compress' },
      { id: 'pdf-merge', name: 'Gộp PDF', icon: 'fa-object-group' },
    ];
  }

  initDragDrop() {
    const paletteTools = document.querySelectorAll('.palette-tool');
    const dropArea = document.getElementById('chain-drop-area');
    const stepsContainer = document.getElementById('chain-steps');

    paletteTools.forEach(tool => {
      tool.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('tool-id', tool.dataset.toolId);
      });
    });

    dropArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropArea.classList.add('dragover');
    });

    dropArea.addEventListener('dragleave', () => {
      dropArea.classList.remove('dragover');
    });

    dropArea.addEventListener('drop', (e) => {
      e.preventDefault();
      dropArea.classList.remove('dragover');
      const toolId = e.dataTransfer.getData('tool-id');
      this.addStep(toolId);
    });
  }

  addStep(toolId) {
    const tool = this.getAvailableTools().find(t => t.id === toolId);
    if (!tool) return;
    this.chain.push(tool);
    this.renderSteps();
  }

  renderSteps() {
    const container = document.getElementById('chain-steps');
    if (this.chain.length === 0) {
      container.innerHTML = `<p class="empty-chain">Chưa có công cụ nào. Kéo thả từ bên trái.</p>`;
      return;
    }
    container.innerHTML = this.chain.map((tool, idx) => `
      <div class="chain-step">
        <span class="step-number">${idx + 1}</span>
        <i class="fas ${tool.icon}"></i>
        <span class="step-name">${tool.name}</span>
        <button class="step-remove" data-index="${idx}">×</button>
        ${idx < this.chain.length - 1 ? '<span class="step-arrow">→</span>' : ''}
      </div>
    `).join('');
    
    // Xóa step
    container.querySelectorAll('.step-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        this.chain.splice(idx, 1);
        this.renderSteps();
      });
    });
  }

  async runChain() {
    const resultContainer = document.getElementById('chain-result');
    resultContainer.classList.remove('hidden');
    resultContainer.innerHTML = `<div class="chain-loading">⏳ Đang xử lý chuỗi...</div>`;
    
    let data = null;
    for (let i = 0; i < this.chain.length; i++) {
      const tool = this.chain[i];
      resultContainer.innerHTML += `<div class="chain-progress">✅ Đang chạy: ${tool.name}...</div>`;
      // Gọi tool tương ứng với dữ liệu từ bước trước
      // Đây là phần tích hợp với các tool hiện có
      await this.delay(500);
    }
    resultContainer.innerHTML += `<div class="chain-success">✅ Hoàn thành! Kết quả sẽ được hiển thị ở đây.</div>`;
  }

  delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  initButtons() {
    document.getElementById('run-chain')?.addEventListener('click', () => this.runChain());
    document.getElementById('clear-chain')?.addEventListener('click', () => {
      this.chain = [];
      this.renderSteps();
    });
    document.getElementById('save-chain')?.addEventListener('click', () => {
      // Lưu chuỗi vào localStorage để dùng sau
      localStorage.setItem('saved-chain', JSON.stringify(this.chain));
      alert('💾 Đã lưu chuỗi công cụ!');
    });
  }
}

// Khởi tạo khi DOM ready
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('chain-builder')) {
    window.chainBuilder = new ToolChainBuilder();
    window.chainBuilder.render();
  }
});