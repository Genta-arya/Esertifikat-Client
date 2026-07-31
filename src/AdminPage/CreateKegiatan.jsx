import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Image as ImageIcon, 
  FileCheck,
  FileText,
  Loader2,
  Sparkles,
  Link2,
  Copy,
  Check,
  QrCode,
  Download,
  Hash,
  Lock,
  RefreshCw
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { UploadImage } from '../Config/AxiosInstance';

// Import Firestore SDK
import { doc, setDoc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../Config/Firebase';

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 2MB dalam bytes
const KPU_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/KPU_Logo.svg/1920px-KPU_Logo.svg.png';

const CreateKegiatan = () => {
  const navigate = useNavigate();

  // State Form Utama
  const [namaKegiatan, setNamaKegiatan] = useState('');
  const [slug, setSlug] = useState('');
  
  // State Nomor Sertifikat & Bank Data
  const [kodeUndangan, setKodeUndangan] = useState(''); // Kolom 1 (Manual Admin)
  const currentYear = new Date().getFullYear();         // Kolom 2 (Tahun berjalan)
  const [estimatedNextNum, setEstimatedNextNum] = useState('0001'); // Estimasi nomor urut dari Bank Data
  const [loadingCounter, setLoadingCounter] = useState(true);

  // State Banner
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  
  // State Template Sertifikat
  const [templateFile, setTemplateFile] = useState(null);
  const [templatePreview, setTemplatePreview] = useState('');
  const [templateUrl, setTemplateUrl] = useState('');

  // Status Loading & Utility
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form Public Full URL
  const publicFormUrl = slug ? `${window.location.origin}/kegiatan/${slug}` : '';

  // 1. FUNGSI CEK BANK DATA NOMOR TERAKHIR DARI FIRESTORE
  const fetchBankDataCounter = async () => {
    setLoadingCounter(true);
    try {
      const counterDocRef = doc(db, 'counters', `sertifikat_${currentYear}`);
      const counterSnap = await getDoc(counterDocRef);

      if (counterSnap.exists()) {
        const lastNumber = counterSnap.data().lastNumber || 0;
        const nextNumber = lastNumber + 1;
        setEstimatedNextNum(String(nextNumber).padStart(4, '0'));
      } else {
        // Jika bank data belum ada di tahun ini, mulai dari 0001
        setEstimatedNextNum('0001');
      }
    } catch (err) {
      console.error('Error fetching bank data counter:', err);
      setEstimatedNextNum('0001');
    } finally {
      setLoadingCounter(false);
    }
  };

  useEffect(() => {
    fetchBankDataCounter();
  }, [currentYear]);

  // Auto Generate Slug dari Nama Kegiatan
  const handleNamaChange = (e) => {
    const val = e.target.value;
    setNamaKegiatan(val);
    
    const generatedSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '') 
      .replace(/\s+/g, '-') 
      .replace(/-+/g, '-');
      
    setSlug(generatedSlug);
  };

  // Handle Pilih Gambar Banner dengan Validasi 2MB
  const handleSelectBanner = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        alert('Ukuran file banner melebihi batas 2MB!');
        e.target.value = null;
        return;
      }
      setBannerFile(file);
      setBannerPreview(URL.createObjectURL(file));
      setBannerUrl('');
    }
  };

  // Handle Pilih File Template Sertifikat dengan Validasi 2MB
  const handleSelectTemplate = (e) => {
    const file = e.target.files[0];
    if (file) {
     

      if (file.size > MAX_FILE_SIZE) {
        alert('Ukuran file template sertifikat melebihi batas 2MB!');
        e.target.value = null;
        return;
      }

      setTemplateFile(file);
      setTemplatePreview(URL.createObjectURL(file));
      setTemplateUrl('');
    }
  };

  // Generic Function Upload File ke Cloud Server
  const uploadToCloud = async (fileToUpload) => {
    if (!fileToUpload) return null;

    try {
      const response = await UploadImage(fileToUpload);
      
      const uploadedUrl = 
        response?.file_url || 
        response?.url || 
        response?.data?.url || 
        response?.data?.file_url || 
        (typeof response === 'string' ? response : null);
      
      if (!uploadedUrl) {
        throw new Error('URL hasil upload tidak ditemukan.');
      }

      return uploadedUrl;
    } catch (error) {
      console.error('Upload Error:', error);
      alert(`Gagal mengunggah ${fileToUpload.name} ke cloud server.`);
      return null;
    }
  };

  // Salin Link Slug
  const handleCopyLink = () => {
    if (!publicFormUrl) return;
    navigator.clipboard.writeText(publicFormUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download QR Code sebagai Gambar PNG
  const handleDownloadQR = () => {
    const svgElement = document.getElementById('kpu-qrcode-svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 1000;
      canvas.height = 1000;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, 1000, 1000);

      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `QR-${slug || 'kegiatan'}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  // 2. SUBMIT FORM KEGIATAN & VERIFIKASI ULANG BANK DATA VIA FIRESTORE TRANSACTION
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!namaKegiatan || !slug) return alert('Nama Kegiatan & Slug wajib diisi!');
    if (!kodeUndangan.trim()) return alert('Format Kode Sertifikat wajib diisi!');

    setIsSubmitting(true);
    setIsUploading(true);

    try {
      // Step A: Upload File Banner jika ada
      let finalBannerUrl = bannerUrl;
      if (bannerFile && !finalBannerUrl) {
        finalBannerUrl = await uploadToCloud(bannerFile);
        if (!finalBannerUrl) {
          setIsSubmitting(false);
          setIsUploading(false);
          return;
        }
        setBannerUrl(finalBannerUrl);
      }

      // Step B: Upload File Template Sertifikat jika ada
      let finalTemplateUrl = templateUrl;
      if (templateFile && !finalTemplateUrl) {
        finalTemplateUrl = await uploadToCloud(templateFile);
        if (!finalTemplateUrl) {
          setIsSubmitting(false);
          setIsUploading(false);
          return;
        }
        setTemplateUrl(finalTemplateUrl);
      }

      setIsUploading(false);

      // Step C: RE-CHECK DENGAN TRANSACTION AGAR NOMOR FIX DAN TIDAK BENTROK
      const cleanKode = kodeUndangan.trim().toUpperCase();
      const counterDocRef = doc(db, 'counters', `sertifikat_${currentYear}`);
      const kegiatanDocRef = doc(db, 'kegiatan', slug);

      let finalAssignedNumber = '';

      await runTransaction(db, async (transaction) => {
        // 1. Re-check nomor terakhir dari bank data
        const counterSnap = await transaction.get(counterDocRef);
        let currentLast = 0;

        if (counterSnap.exists()) {
          currentLast = counterSnap.data().lastNumber || 0;
        }

        const nextNumVal = currentLast + 1;
        finalAssignedNumber = String(nextNumVal).padStart(4, '0');

        // 2. Update Bank Data dengan nomor baru yang sudah terpakai
        transaction.set(counterDocRef, {
          lastNumber: nextNumVal,
          updatedAt: serverTimestamp()
        }, { merge: true });

        // 3. Simpan data kegiatan beserta kode undangan dan starting number
        transaction.set(kegiatanDocRef, {
          namaKegiatan,
          slug,
          kodeUndangan: cleanKode,
          startingNumber: finalAssignedNumber, // Menandai nomor pertama kegiatan ini
          bannerUrl: finalBannerUrl || '',
          templateUrl: finalTemplateUrl || '',
          formFields: ['nama', 'email', 'instansi', 'jabatan'],
          totalPeserta: 0,
          terkirim: 0,
          aktif: true,
          createdAt: serverTimestamp(),
        });
      });

      alert(`Kegiatan "${namaKegiatan}" berhasil disimpan!\nNomor urut resmi diawali dari: ${finalAssignedNumber}/${cleanKode}/${currentYear}`);
      navigate('/admin/dashboard');
    } catch (error) {
      console.error('Firestore Transaction Error:', error);
      alert('Terjadi kesalahan saat menyimpan data: ' + error.message);
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col mx-auto shadow-2xl border-x border-slate-800 relative">
      
      {/* 1. HEADER */}
      <header className="bg-slate-800/80 backdrop-blur-md p-4 sticky top-0 z-20 border-b border-slate-700/50 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-slate-700/50 hover:bg-slate-700 text-slate-200 rounded-xl transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-bold leading-tight">Buat Kegiatan Baru</h1>
          <p className="text-xs text-slate-400">Atur judul, nomor sertifikat, banner, & QR Code</p>
        </div>
      </header>

      {/* 2. FORM CONTENT */}
      <form onSubmit={handleSubmit} className="flex-1 p-4 pb-28 space-y-5">
        
        {/* NAMA KEGIATAN */}
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

        {/* CUSTOM SLUG / LINK PUBLIK */}
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

        {/* SECTION FORMAT NOMOR SERTIFIKAT (2 KOLOM) */}
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
            {/* Kolom 1: Ketik Manual Kode Undangan / Instansi */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-medium">1. Kode / Surat (Manual)</span>
              <input
                type="text"
                placeholder="Contoh: KPU-SKD/BIMTEK"
                value={kodeUndangan}
                onChange={(e) => setKodeUndangan(e.target.value)}
                className="w-full px-3.5 mt-0.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 uppercase font-mono transition-all"
                required
              />
            </div>

            {/* Kolom 2: Locked / Otomatis Cek Bank Data */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-medium flex items-center justify-between">
                <span>2. Estimasi Urutan & Tahun</span>
                <span className="text-slate-500 text-[9px] flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> Bank Data</span>
              </span>
              <div className="relative">
                <input
                  type="text"
                  value={loadingCounter ? 'Memeriksa Bank Data...' : `[${estimatedNextNum}] / ${currentYear}`}
                  disabled
                  className="w-full px-3.5 py-2.5 mt-1 bg-slate-950/80 border border-slate-800 text-slate-400 text-xs font-mono rounded-xl cursor-not-allowed select-none"
                />
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
            Preview format hasil akhir: <span className="text-blue-400 font-mono font-bold">{estimatedNextNum}/{kodeUndangan.trim().toUpperCase() || 'KODE'}/{currentYear}</span>
          </p>
        </div>

        {/* SECTION PREVIEW QR CODE KPU */}
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

        {/* UPLOAD BANNER */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Banner Kegiatan
          </label>

          <div className="border-2 border-dashed border-slate-700 hover:border-blue-500/50 rounded-2xl p-4 text-center bg-slate-800/40 transition-all relative overflow-hidden">
            {bannerPreview ? (
              <div className="space-y-2">
                <img
                  src={bannerPreview}
                  alt="Preview Banner"
                  className="w-full h-32 object-cover rounded-xl border border-slate-700"
                />
                <div className="flex items-center justify-center gap-2 pt-1">
                  <label className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg cursor-pointer transition-all">
                    Ganti Gambar
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSelectBanner}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="cursor-pointer space-y-2 block py-3">
                <div className="w-10 h-10 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">Pilih File Banner</p>
                  <p className="text-[10px] text-slate-400">PNG, JPG, atau WEBP (Maksimal 2MB)</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSelectBanner}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* UPLOAD TEMPLATE SERTIFIKAT */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span>Template Sertifikat</span>
            <span className="text-[10px] text-indigo-400 font-normal">Format Gambar (PNG/JPG)</span>
          </label>

          <div className="border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/60 rounded-2xl p-4 text-center bg-indigo-950/20 transition-all relative overflow-hidden">
            {templateFile ? (
              <div className="space-y-2">
                {templatePreview ? (
                  <img
                    src={templatePreview}
                    alt="Preview Template"
                    className="w-full h-36 object-contain rounded-xl border border-indigo-500/30 bg-slate-950/50"
                  />
                ) : (
                  <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center justify-center gap-2">
                    <FileText className="w-6 h-6 text-indigo-400" />
                    <span className="text-xs text-slate-200 truncate">{templateFile.name}</span>
                  </div>
                )}
                
                <div className="flex items-center justify-center gap-2 pt-1">
                  <label className="text-xs bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 px-3 py-1.5 rounded-lg cursor-pointer transition-all">
                    Ganti Template
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/jpg"
                      onChange={handleSelectTemplate}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="cursor-pointer space-y-2 block py-3">
                <div className="w-10 h-10 rounded-full bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">Upload Desain Sertifikat Kosong</p>
                  <p className="text-[10px] text-slate-400">Format PNG / JPG (Maksimal 2MB)</p>
                </div>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handleSelectTemplate}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* INFORMASI FORM PUBLIK */}
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

        {/* SUBMIT BUTTON */}
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

      </form>
    </div>
  );
};

export default CreateKegiatan;