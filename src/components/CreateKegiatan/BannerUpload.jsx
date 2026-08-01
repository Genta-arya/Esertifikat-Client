import React from 'react';
import { ImagePlus, FileText } from 'lucide-react';

const ALLOWED_IMAGE_TYPES = 'image/png, image/jpeg, image/jpg, image/webp';

const BannerUpload = ({ bannerFile, bannerPreview, onSelectBanner }) => {
  const hasContent = Boolean(bannerFile || bannerPreview);

  return (
    <div className="space-y-1.5">
      {/* Header Label */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Banner
        </span>
        <span className="text-[10px] text-indigo-400 font-normal">
          Format Gambar (PNG/JPG/WEBP)
        </span>
      </div>

      {/* Upload Zone */}
      <div className="border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/60 rounded-2xl p-4 text-center bg-indigo-950/20 transition-all relative overflow-hidden">
        {/* Single Hidden Input untuk seluruh kondisi */}
        <input
          id="banner-upload-input"
          type="file"
          accept={ALLOWED_IMAGE_TYPES}
          onChange={onSelectBanner}
          className="hidden"
        />

        {hasContent ? (
          <div className="space-y-2">
            {bannerPreview ? (
              <img
                src={bannerPreview}
                alt="Banner Preview"
                className="w-full h-36 object-cover rounded-xl border border-indigo-500/30 bg-slate-950/50"
              />
            ) : (
              <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center justify-center gap-2">
                <FileText className="w-6 h-6 text-indigo-400" />
                <span className="text-xs text-slate-200 truncate">
                  {bannerFile?.name || 'Banner Terpilih'}
                </span>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 pt-1">
              <label
                htmlFor="banner-upload-input"
                className="text-xs bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 px-3 py-1.5 rounded-lg cursor-pointer transition-all inline-block"
              >
                Ganti Banner
              </label>
            </div>
          </div>
        ) : (
          <label
            htmlFor="banner-upload-input"
            className="cursor-pointer space-y-2 block py-3"
          >
            <div className="w-10 h-10 rounded-full bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
              <ImagePlus className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">Upload Banner</p>
              <p className="text-[10px] text-slate-400">Format PNG / JPG / WEBP (Maksimal 2MB)</p>
            </div>
          </label>
        )}
      </div>
    </div>
  );
};

export default BannerUpload;