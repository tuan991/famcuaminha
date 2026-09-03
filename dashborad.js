// dashboard.js
class UserDashboard {
  constructor() {
    this.stats = this.loadStats();
    this.recentTools = this.loadRecentTools();
  }

  loadStats() {
    return {
      toolsUsed: parseInt(localStorage.getItem('tools_used') || '0'),
      filesProcessed: parseInt(localStorage.getItem('files_processed') || '0'),
      timeSaved: parseInt(localStorage.getItem('time_saved') || '0'),
      favoriteTools: JSON.parse(localStorage.getItem('favorite_tools') || '[]')
    };
  }

  loadRecentTools() {
    return JSON.parse(localStorage.getItem('recent_tools') || '[]');
  }

  render() {
    const container = document.getElementById('dashboard-container');
    if (!container) return;
    container.innerHTML = `
      <div class="dashboard-header">
        <h2>📊 Bảng điều khiển cá nhân</h2>
        <p class="welcome">Chào mừng bạn quay trở lại!</p>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">🛠️</div>
          <div class="stat-number">${this.stats.toolsUsed}</div>
          <div class="stat-label">Công cụ đã dùng</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📁</div>
          <div class="stat-number">${this.stats.filesProcessed}</div>
          <div class="stat-label">File đã xử lý</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⏱️</div>
          <div class="stat-number">${this.stats.timeSaved}</div>
          <div class="stat-label">Phút tiết kiệm</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">❤️</div>
          <div class="stat-number">${this.stats.favoriteTools.length}</div>
          <div class="stat-label">Tool yêu thích</div>
        </div>
      </div>
      <div class="dashboard-section">
        <h3>🔮 Gợi ý công cụ cho bạn</h3>
        <div class="tool-suggestions-grid">
          ${this.getSuggestions().map(t => `
            <a href="${t.url}" class="suggestion-card">
              <i class="fas ${t.icon}"></i>
              <span>${t.name}</span>
              <small>${t.reason}</small>
            </a>
          `).join('')}
        </div>
      </div>
      <div class="dashboard-section">
        <h3>🕒 Công cụ gần đây</h3>
        <div class="recent-tools-list">
          ${this.recentTools.slice(0, 5).map(t => `
            <a href="${t.url}" class="recent-tool-item">
              <i class="fas ${t.icon}"></i>
              ${t.name}
              <span class="recent-time">${t.time}</span>
            </a>
          `).join('') || '<p class="empty-message">Chưa dùng công cụ nào.</p>'}
        </div>
      </div>
    `;
  }

  getSuggestions() {
    const allTools = window.APP_TOOLS || [
      { id: 'json-formatter', name: 'JSON Formatter', icon: 'fa-brackets-curly', url: '/tools/json-formatter/' },
      { id: 'pdf-merge', name: 'Gộp PDF', icon: 'fa-object-group', url: '/tools/pdf-merge/' },
      { id: 'image-compress', name: 'Nén ảnh', icon: 'fa-compress', url: '/tools/image-compress/' },
    ];
    // Gợi ý dựa trên lịch sử
    const usedIds = this.recentTools.map(t => t.id);
    const suggestions = allTools.filter(t => !usedIds.includes(t.id));
    return suggestions.slice(0, 4).map(t => ({
      ...t,
      reason: '🔥 Có thể bạn sẽ thích'
    }));
  }
}