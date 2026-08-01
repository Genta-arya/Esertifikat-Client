import React from "react";
import { Presentation, Info, CheckCircle2 } from "lucide-react";

const ALLOWED_PPTX_TYPES =
  ".pptx, application/vnd.openxmlformats-officedocument.presentationml.presentation";

const TemplateUpload = ({ templateFile, onSelectTemplate }) => {
  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="space-y-2">
      {/* Header Label */}
      <div className="flex items-center justify-between">
        <label
          htmlFor="template-upload-input"
          className="text-xs font-bold text-slate-300 uppercase tracking-wider"
        >
          Template Sertifikat
        </label>
        <span className="text-[10px] text-indigo-400 font-normal">
          Format File (PPTX)
        </span>
      </div>

      {/* Info Box dengan Panduan Langkah */}
      <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-slate-300 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1.5 text-[11px] leading-relaxed">
          <p className="font-semibold text-indigo-200">Panduan Pembuatan Template:</p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300">
            <li>Export desain sertifikat ke format <strong>PNG</strong> ukuran <strong>1536 x 1024</strong>.</li>
            <li>Buka PowerPoint, lalu atur ukuran slide dan masukkan gambar desain tersebut sebagai latar belakang/background.</li>
            <li>Tambahkan Text Box berisi <code className="text-indigo-300 bg-indigo-950/60 px-1 py-0.5 rounded font-mono font-bold">{"{{nama}}"}</code> dan <code className="text-indigo-300 bg-indigo-950/60 px-1 py-0.5 rounded font-mono font-bold">{"{{no}}"}</code> pada posisi yang diinginkan.</li>
          </ol>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/60 rounded-2xl p-4 text-center bg-indigo-950/20 transition-all relative overflow-hidden">
        <input
          id="template-upload-input"
          type="file"
          accept={ALLOWED_PPTX_TYPES}
          onChange={onSelectTemplate}
          className="hidden"
        />

        {templateFile ? (
          <div className="space-y-3">
            {/* Card Info File Terverifikasi */}
            <div className="p-3.5 bg-slate-800/90 rounded-xl border border-slate-700 flex items-center justify-between gap-3 text-left">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                  <Presentation className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold text-slate-200 truncate">
                    {templateFile.name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {formatFileSize(templateFile.size)} • Document PPTX
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 text-emerald-400 text-xs font-medium bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Siap</span>
              </div>
            </div>

            {/* Action Button */}
            <div className="flex items-center justify-center">
              <label
                htmlFor="template-upload-input"
                className="text-xs bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 px-3 py-1.5 rounded-lg cursor-pointer transition-all inline-block"
              >
                Ganti File PPTX
              </label>
            </div>
          </div>
        ) : (
          <label
            htmlFor="template-upload-input"
            className="cursor-pointer space-y-2 block py-3"
          >
            <div className="w-10 h-10 rounded-full bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
              <Presentation className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">
                Upload Template PPTX
              </p>
              <p className="text-[10px] text-slate-400">
                Format PPTX (Maksimal 3MB)
              </p>
            </div>
          </label>
        )}
      </div>
    </div>
  );
};

export default TemplateUpload;