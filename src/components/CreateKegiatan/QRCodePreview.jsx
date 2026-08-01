import React from 'react';
import { QrCode, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const KPU_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/KPU_Logo.svg/1920px-KPU_Logo.svg.png';

const QRCodePreview = ({ slug, publicFormUrl, handleDownloadQR }) => {
  return (
    <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <QrCode className="w-4 h-4 text-blue-400" /> QR Code Form Peserta
        </span>
        {slug && (
          <button
            type="button"
            onClick={handleDownloadQR}
            className="text-[11px] bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all"
          >
            <Download className="w-3 h-3" /> Unduh QR
          </button>
        )}
      </div>

      <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-inner border border-slate-200">
        {slug ? (
          <QRCodeSVG
            id="kpu-qrcode-svg"
            value={publicFormUrl}
            size={180}
            bgColor="#FFFFFF"
            fgColor="#000000"
            level="H"
            imageSettings={{
              src: KPU_LOGO_URL,
              x: undefined,
              y: undefined,
              height: 40,
              width: 40,
              excavate: true,
            }}
          />
        ) : (
          <div className="w-44 h-44 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-center p-4">
            <p className="text-xs text-slate-400">Ketik nama kegiatan untuk memunculkan QR Code</p>
          </div>
        )}
      </div>
      <p className="text-[10px] text-slate-400 text-center">
        Peserta dapat men-scan QR ini di lokasi untuk langsung mengisi form e-sertifikat.
      </p>
    </div>
  );
};

export default QRCodePreview;
