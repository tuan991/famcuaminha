// tools/ai-image-upscaler.js
class AIUpscaler {
  constructor() {
    this.apiKey = localStorage.getItem('huggingface_api_key') || '';
    this.apiUrl = 'https://api-inference.huggingface.co/models/';
  }

  async upscale(imageData, scale = 2) {
    if (!this.apiKey) {
      throw new Error('Vui lòng thêm API Key Hugging Face (miễn phí)');
    }
    const model = 'lllyasviel/sd-upscaler-real-esrgan';
    const response = await fetch(this.apiUrl + model, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: imageData })
    });
    if (!response.ok) throw new Error('Lỗi khi upscale ảnh');
    return await response.blob();
  }

  render() {
    return `
      <div class="tool-container">
        <h2>🖼️ AI Image Upscaler</h2>
        <p>Tăng chất lượng ảnh lên gấp 2-4 lần miễn phí</p>
        <div class="upload-area">
          <input type="file" accept="image/*" id="upscale-input">
          <div class="scale-select">
            <label>Độ phóng to:</label>
            <select id="upscale-scale">
              <option value="2">2x</option>
              <option value="4">4x</option>
            </select>
          </div>
          <button id="upscale-btn" class="btn btn-primary">🔄 Tăng chất lượng</button>
        </div>
        <div id="upscale-result"></div>
        <div class="api-key-note">
          <small>🔑 Cần API Key Hugging Face miễn phí: <a href="https://huggingface.co/settings/tokens" target="_blank">Lấy token</a></small>
        </div>
      </div>
    `;
  }
}