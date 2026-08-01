import React from 'react';

const PublicFormInfo = () => {
  return (
    <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 space-y-2">
      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
        Form yang Akan Diisi Peserta (Otomatis)
      </span>
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 pt-1">
        <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700/50">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Nama Lengkap
        </div>
        <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700/50">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Alamat Email
        </div>
        <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700/50">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Instansi / Lembaga
        </div>
        <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700/50">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Jabatan / Peran
        </div>
      </div>
    </div>
  );
};

export default PublicFormInfo;
