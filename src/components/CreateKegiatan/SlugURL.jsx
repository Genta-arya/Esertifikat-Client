import React from 'react';
import { Link2, Copy, Check } from 'lucide-react';

const SlugURL = ({ slug, setSlug, publicFormUrl, handleCopyLink, copied }) => {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
        <span>Slug URL Kegiatan</span>
        <span className="text-[10px] text-blue-400 font-normal">Otomatis dari nama</span>
      </label>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-3 text-xs text-slate-500 flex items-center gap-1">
            <Link2 className="w-3.5 h-3.5" />
          </span>
          <input
            type="text"
            placeholder="bimtek-kpps-2026"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
            className="w-full pl-8 pr-4 py-2.5 bg-slate-800/90 border border-slate-700/80 rounded-xl text-xs text-blue-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            required
          />
        </div>
        
        <button
          type="button"
          onClick={handleCopyLink}
          disabled={!slug}
          className="p-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-xl transition-all disabled:opacity-40"
          title="Salin Link"
        >
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-[11px] text-slate-400">
        Tautan publik: <span className="text-slate-300 font-mono">{publicFormUrl || '/kegiatan/...'}</span>
      </p>
    </div>
  );
};

export default SlugURL;
