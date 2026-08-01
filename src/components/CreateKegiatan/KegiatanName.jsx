import React from 'react';

const KegiatanName = ({ namaKegiatan, handleNamaChange }) => {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
        Nama Kegiatan <span className="text-red-400">*</span>
      </label>
      <input
        type="text"
        placeholder="Contoh: Bimtek KPPS Pemilu 2026"
        value={namaKegiatan}
        onChange={handleNamaChange}
        className="w-full px-4 py-3 bg-slate-800/90 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
        required
      />
    </div>
  );
};

export default KegiatanName;
