// tools/pdf-ocr.js
class PDFOCR {
  constructor() {
    this.worker = null;
  }

  async init() {
    // Sử dụng Tesseract.js miễn phí (chạy local)
    this.worker = await Tesseract.createWorker('vie');
  }

  async extractTextFromPDF(pdfFile) {
    // Chuyển PDF sang ảnh rồi OCR
    const pdfjs = window.pdfjsLib;
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjs.getDocument(arrayBuffer).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      const imageData = canvas.toDataURL('image/png');
      const { data: { text } } = await this.worker.recognize(imageData);
      fullText += text + '\n\n';
    }
    return fullText;
  }

  render() {
    return `
      <div class="tool-container">
        <h2>📄 PDF OCR - Nhận dạng chữ</h2>
        <p>Trích xuất văn bản từ file PDF có ảnh</p>
        <div class="upload-area">
          <input type="file" accept=".pdf" id="pdf-ocr-input">
          <button id="pdf-ocr-btn" class="btn btn-primary">🔍 Trích xuất</button>
        </div>
        <div id="pdf-ocr-result" class="result-box"></div>
      </div>
    `;
  }
}