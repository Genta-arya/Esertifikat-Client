import React from 'react';
import { Hash, Edit3, RefreshCw } from 'lucide-react';

const CertificateNumberFormat = ({
  kodeUndangan,
  setKodeUndangan,
  loadingCounter,
  estimatedNextNum,
  setEstimatedNextNum,
  currentYear,
  setCurrentYear,
  fetchBankDataCounter,
}) => {
  return (
    <div className="bg-slate-800/50 border border-slate-700/80 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Hash className="w-4 h-4 text-blue-400" /> Format Nomor Sertifikat <span className="text-red-400">*</span>
        </label>
        <button
          type="button"
          onClick={fetchBankDataCounter}
          className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
          title="Cek Ulang Bank Data"
        >
          <RefreshCw className={`w-3 h-3 ${loadingCounter ? 'animate-spin' : ''}`} /> Refresh Bank Data
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <span className="text-[10px] text-slate-400 font-medium">1. Kode / Surat (Manual)</span>
          <input
            type="text"
            placeholder="Contoh: KPU-SKD/BIMTEK"
            value={kodeUndangan}
            onChange={(e) => setKodeUndangan(e.target.value)}
            className="w-full px-3.5 mt-0.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono transition-all"
            required
          />
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-slate-400 font-medium flex items-center justify-between">
            <span>2. Nomor Urut & Tahun (Dapat Disesuaikan)</span>
            <span className="text-blue-400 text-[9px] flex items-center gap-0.5"><Edit3 className="w-2.5 h-2.5" /> Editable</span>
          </span>
          <div className="grid grid-cols-2 gap-2 mt-0.5">
            <input
              type="number"
              placeholder="No. Urut"
              value={estimatedNextNum}
              onChange={(e) => setEstimatedNextNum(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono transition-all"
              required
            />
            <input
              type="text"
              placeholder="Tahun"
              value={currentYear}
              onChange={(e) => setCurrentYear(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono transition-all"
              required
            />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
        Preview format hasil akhir: <span className="text-blue-400 font-mono font-bold">{estimatedNextNum || 'NO'}/{kodeUndangan || 'KODE'}/{currentYear || 'TAHUN'}</span>
      </p>
    </div>
  );
};

export default CertificateNumberFormat;