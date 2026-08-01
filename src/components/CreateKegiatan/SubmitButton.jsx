import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

const SubmitButton = ({ isSubmitting, isUploading, loadingCounter }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-slate-900/80 backdrop-blur-md border-t border-slate-800 z-30">
      <button
        type="submit"
        disabled={isSubmitting || isUploading || loadingCounter}
        className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-[0.98]"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Memverifikasi & Menyimpan...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            <span>Terbitkan & Buat Link Publik</span>
          </>
        )}
      </button>
    </div>
  );
};

export default SubmitButton;
