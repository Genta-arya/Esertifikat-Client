import { useState } from 'react';
import jsPDF from 'jspdf';

export const useDownloadCertificate = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  /**
   * Helper internal untuk memuat gambar template secara async
   */
  const loadImage = (src) => {
    return new Promise((resolve, reject) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'Anonymous'; // Mencegah Canvas CORS Taint
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = src;
    });
  };

  /**
   * Function utama untuk Generate dan Download PDF Sertifikat Resmi
   */
  const downloadCertificatePDF = async ({ nama, nomorSertifikat, templateUrl, namaKegiatan }) => {
    setIsGenerating(true);
    setDownloadError('');
    setDownloadSuccess(false);

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      let img = null;
      try {
        img = await loadImage(templateUrl);
      } catch (e) {
        console.warn('Gagal memuat template gambar admin, menggunakan fallback background.', e);
      }

      const width = img?.naturalWidth || 1200;
      const height = img?.naturalHeight || 850;

      canvas.width = width;
      canvas.height = height;

      // 1. Draw Template Admin sebagai Background
      if (img) {
        ctx.drawImage(img, 0, 0, width, height);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 10;
        ctx.strokeRect(30, 30, width - 60, height - 60);
      }

      // 2. Setup Teks
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#0f172a';

      // A. Render Nomor Sertifikat Resmi
      const nomorFontSize = Math.round(width * 0.016);
      ctx.font = `bold ${nomorFontSize}px sans-serif`;
      const marginLeft = width * 0.02;
      ctx.fillText(nomorSertifikat, width / 2 + marginLeft, height * 0.3);

      // B. Render Nama Peserta
      const maxWidth = width * 0.68;
      let namaFontSize = Math.round(width * 0.035);
      ctx.font = `bold ${namaFontSize}px sans-serif`;

      const words = nama.trim().split(' ');
      let lines = [];
      let currentLine = words[0];

      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine + ' ' + word;
        if (ctx.measureText(testLine).width > maxWidth) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      lines.push(currentLine);

      if (lines.length > 1) {
        namaFontSize = Math.round(width * 0.028);
        ctx.font = `bold ${namaFontSize}px sans-serif`;
      }

      const lineHeight = namaFontSize * 1.2;
      const startY = lines.length > 1 ? height * 0.4 : height * 0.42;

      lines.forEach((line, index) => {
        ctx.fillText(line, width / 2, startY + index * lineHeight);
      });

      // 3. Render ke jsPDF & Pemicu Auto-Download PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: width > height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [width, height],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, width, height);

      // Nama File PDF yang Diunduh
      const fileName = `Sertifikat_${nama.replace(/\s+/g, '_')}.pdf`;
      pdf.save(fileName);

      setDownloadSuccess(true);
      return true;
    } catch (error) {
      console.error('Error downloadCertificatePDF:', error);
      setDownloadError(error.message || 'Gagal mengunduh sertifikat.');
      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    downloadCertificatePDF,
    isGenerating,
    downloadSuccess,
    downloadError,
  };
};