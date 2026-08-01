import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  ShieldCheck,
  User,
  Mail,
  Building2,
  Briefcase,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Download,
  X,
} from "lucide-react";

import {
  doc,
  getDoc,
  collection,
  runTransaction,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../utils/Firebase";

const FormPresensi = () => {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const emailParam = searchParams.get("email")?.trim().toLowerCase();

  const [kegiatan, setKegiatan] = useState(null);
  const [loadingKegiatan, setLoadingKegiatan] = useState(true);
  const [kegiatanError, setKegiatanError] = useState("");

  // State untuk Toast Notification
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "error",
  });

  const [formData, setFormData] = useState({
    nama: "",
    email: emailParam || "",
    instansi: "",
    jabatan: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedNomor, setGeneratedNomor] = useState("");

  // State khusus loading download via backend
  const [isGeneratingBackend, setIsGeneratingBackend] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const currentYear = new Date().getFullYear();

  // Fungsi helper untuk menampilkan toast
  const showToast = (message, type = "error") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "error" });
    }, 5000);
  };

  useEffect(() => {
    const fetchKegiatanAndCheckEmail = async () => {
      if (!slug) {
        setKegiatanError("Link kegiatan tidak valid.");
        setLoadingKegiatan(false);
        return;
      }

      try {
        const docRef = doc(db, "kegiatan", slug);
        let docSnap = await getDoc(docRef);

        let data = null;
        let docId = slug;

        if (docSnap.exists()) {
          data = docSnap.data();
        } else {
          const q = query(
            collection(db, "kegiatan"),
            where("slug", "==", slug),
          );
          const querySnap = await getDocs(q);

          if (!querySnap.empty) {
            const matchedDoc = querySnap.docs[0];
            data = matchedDoc.data();
            docId = matchedDoc.id;
          }
        }

        if (!data) {
          setKegiatanError("Kegiatan tidak ditemukan.");
          return;
        }

        if (data.aktif === false) {
          setKegiatanError("Presensi untuk kegiatan ini telah ditutup.");
          return;
        }

        setKegiatan({ id: docId, ...data });

        if (emailParam) {
          const pesertaRef = collection(db, "kegiatan", docId, "peserta");
          const qEmail = query(pesertaRef, where("email", "==", emailParam));
          const pesertaSnap = await getDocs(qEmail);

          if (!pesertaSnap.empty) {
            const pesertaData = pesertaSnap.docs[0].data();

            setFormData({
              nama: pesertaData.nama || "",
              email: pesertaData.email || emailParam,
              instansi: pesertaData.instansi || "",
              jabatan: pesertaData.jabatan || "",
            });
            setGeneratedNomor(pesertaData.nomorSertifikat || "");
            setIsSuccess(true);
          } else {
            showToast(
              `Sertifikat dengan email "${emailParam}" belum terdaftar / belum melakukan presensi.`,
              "error",
            );
            setSearchParams({});
            setFormData((prev) => ({ ...prev, email: "" }));
          }
        }
      } catch (error) {
        console.error("Error fetching kegiatan/peserta:", error);
        setKegiatanError("Gagal memuat data kegiatan.");
      } finally {
        setLoadingKegiatan(false);
      }
    };

    fetchKegiatanAndCheckEmail();
  }, [slug, emailParam]);

  // FUNGSI DOWNLOAD SERTIFIKAT MENEMBAK BACKEND EXPRESS
  // FUNGSI DOWNLOAD SERTIFIKAT MENEMBAK BACKEND EXPRESS
  const handleDownloadFromBackend = async ({
    nama,
    nomorSertifikat,
    templateUrl,
  }) => {
    setIsGeneratingBackend(true);
    setDownloadSuccess(false);

    try {
      const response = await fetch(
        "https://esertifikat.apiservices.my.id/api/generate-certificate",
        // "http://localhost:3080/api/generate-certificate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nama,
            nomorSertifikat,
            templateUrl: templateUrl || kegiatan?.templateUrl,
            emailPeserta: formData.email || emailParam || "",
            namaKegiatan: kegiatan?.namaKegiatan || "",
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Gagal memproses sertifikat dari server backend.");
      }

      // 1. Bersihkan garis miring (/) pada nomorSertifikat agar aman digunakan sebagai nama file
      const safeNomor = (nomorSertifikat || generatedNomor || "").replace(
        /\//g,
        "-",
      );
      const safeNama = (nama || formData.nama || "")
        .trim()
        .replace(/\s+/g, "_");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // 2. Gunakan variabel yang sudah dibersihkan
      link.download = `Sertifikat_${safeNomor}_${safeNama}_${kegiatan?.namaKegiatan}.pdf`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadSuccess(true);
    } catch (error) {
      console.error("Error downloading from backend:", error);
      alert("Terjadi kesalahan saat mengunduh sertifikat: " + error.message);
    } finally {
      setIsGeneratingBackend(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // SUBMIT FORM PRESENSI
  // SUBMIT FORM PRESENSI
  const handleSubmit = async (e) => {
    e.preventDefault();
    const namaClean = formData.nama.trim();
    const emailClean = formData.email.trim().toLowerCase();
    const instansiClean = formData.instansi.trim();
    const jabatanClean = formData.jabatan.trim();

    if (!namaClean || !emailClean || !instansiClean || !jabatanClean) {
      alert("Mohon lengkapi semua field!");
      return;
    }

    if (!kegiatan?.id) {
      alert("Data kegiatan tidak valid.");
      return;
    }

    setIsSubmitting(true);

    try {
      const targetDocId = kegiatan.id;
      const pesertaRef = collection(db, "kegiatan", targetDocId, "peserta");

      const checkEmailQuery = query(
        pesertaRef,
        where("email", "==", emailClean),
      );
      const existingPeserta = await getDocs(checkEmailQuery);

      // if (!existingPeserta.empty) {
      //   alert("Email ini sudah pernah mengisi presensi untuk kegiatan ini!");
      //   setIsSubmitting(false);
      //   return;
      // }

      let finalNomorResmi = "";
      const kodeUndangan = kegiatan?.kodeUndangan || "KPU-SKD";
      const counterDocRef = doc(db, "counters", `sertifikat_${currentYear}`);
      const newPesertaDocRef = doc(pesertaRef);
      const kegiatanRef = doc(db, "kegiatan", targetDocId);

      await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterDocRef);
        const kegiatanSnap = await transaction.get(kegiatanRef);

        let currentLast = 0;
        if (counterSnap.exists()) {
          currentLast = counterSnap.data().lastNumber || 0;
        }

        const nextNum = currentLast + 1;
        const formattedNum = String(nextNum).padStart(4, "0");
        finalNomorResmi = `${formattedNum}/${kodeUndangan}/${currentYear}`;

        const currentTotal = kegiatanSnap.data()?.totalPeserta || 0;

        transaction.set(
          counterDocRef,
          {
            lastNumber: nextNum,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        transaction.set(newPesertaDocRef, {
          nama: namaClean,
          email: emailClean,
          instansi: instansiClean,
          jabatan: jabatanClean,
          nomorSertifikat: finalNomorResmi,
          sertifikatTerkirim: false,
          waktuPresensi: serverTimestamp(),
        });

        transaction.update(kegiatanRef, {
          totalPeserta: currentTotal + 1,
        });
      });

      // UPDATE URL TANPA TERTIMPA setSearchParams (Tetap menggunakan @)
      const newUrl = `${window.location.pathname}?email=${emailClean}`;
      window.history.replaceState(null, "", newUrl);

      // Set State Success & Nomor Sertifikat
      setGeneratedNomor(finalNomorResmi);
      setIsSuccess(true);

      // Trigger Auto Download langsung dari Backend Express
      handleDownloadFromBackend({
        nama: namaClean,
        nomorSertifikat: finalNomorResmi,
        templateUrl: kegiatan?.templateUrl,
        emailPeserta: emailClean,
      });
    } catch (error) {
      console.error("Gagal menyimpan presensi:", error);
      alert("Terjadi kesalahan saat menyimpan presensi: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingKegiatan) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm text-slate-400">Memuat form presensi...</p>
        </div>
      </div>
    );
  }

  if (kegiatanError) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="bg-slate-800/80 border border-slate-700 rounded-3xl p-6 text-center max-w-sm w-full space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Presensi Tidak Tersedia
            </h2>
            <p className="text-xs text-slate-400 mt-1">{kegiatanError}</p>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 text-center max-w-sm w-full space-y-4 shadow-2xl relative overflow-hidden">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 flex items-center justify-center mx-auto animate-bounce">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">
              {emailParam ? "Sertifikat Ditemukan!" : "Presensi Berhasil!"}
            </h2>
            <p className="text-xs text-slate-300">
              Halo,{" "}
              <span className="text-blue-400 font-semibold">
                {formData.nama}
              </span>
              .
            </p>
          </div>

          <div className="bg-slate-900/60 rounded-2xl p-4 text-xs text-slate-400 space-y-2 text-left border border-slate-800">
            <p className="flex justify-between">
              <span>Kegiatan:</span>
              <span className="font-semibold text-slate-200 text-right">
                {kegiatan?.namaKegiatan}
              </span>
            </p>
            <p className="flex justify-between">
              <span>Nomor Sertifikat:</span>
              <span className="font-mono text-blue-400 font-bold">
                {generatedNomor}
              </span>
            </p>
            <p className="flex justify-between">
              <span>Email:</span>
              <span className="font-mono text-slate-200">{formData.email}</span>
            </p>
          </div>

          {/* TOMBOL UTAMA DOWNLOAD SERTIFIKAT VIA BACKEND */}
          <button
            type="button"
            onClick={() =>
              handleDownloadFromBackend({
                nama: formData.nama,
                nomorSertifikat: generatedNomor,
                templateUrl: kegiatan?.templateUrl,
                emailPeserta: formData.email,
              })
            }
            disabled={isGeneratingBackend}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-[0.98]"
          >
            {isGeneratingBackend ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses dari Server...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Unduh Sertifikat PDF</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-slate-400 pt-1">
            {isGeneratingBackend
              ? "Sedang mengunduh file sertifikat dari server backend..."
              : downloadSuccess
                ? "✓ File PDF sertifikat resmi berhasil diunduh!"
                : "Klik tombol 'Unduh Sertifikat PDF' di atas untuk mengunduh ulang."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col mx-auto shadow-2xl border-x border-slate-800 relative">
      {toast.show && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md animate-bounce">
          <div className="bg-red-500/90 backdrop-blur-md border border-red-400 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs font-medium">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() =>
                setToast({ show: false, message: "", type: "error" })
              }
              className="text-white/80 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <header className="bg-slate-800/80 backdrop-blur-md p-4 sticky top-0 z-20 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">
              Presensi E-Sertifikat
            </h1>
            <p className="text-xs text-slate-400">KPU Kabupaten Sekadau</p>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-3">
        {kegiatan?.bannerUrl ? (
          <img
            src={kegiatan.bannerUrl}
            alt={kegiatan.namaKegiatan}
            className="w-full h-36 object-cover rounded-2xl border border-slate-700/60 shadow-lg"
          />
        ) : (
          <div className="w-full h-24 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 flex items-center justify-center text-center">
            <h2 className="text-sm font-bold text-white">
              {kegiatan?.namaKegiatan}
            </h2>
          </div>
        )}

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Formulir Kehadiran
          </span>
          <h2 className="text-base font-bold text-white leading-snug">
            {kegiatan?.namaKegiatan}
          </h2>
          <p className="text-xs text-slate-400">
            Silakan isi data diri Anda secara benar untuk penerbitan sertifikat.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 pt-0 space-y-4 flex-1 pb-10">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Nama Lengkap <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              name="nama"
              maxLength={60}
              placeholder="Contoh: Dr. xxxx"
              value={formData.nama}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-3 bg-slate-800/90 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Alamat Email <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="email"
              name="email"
              placeholder="nama@email.com"
              value={formData.email}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-3 bg-slate-800/90 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Instansi / Lembaga <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              name="instansi"
              placeholder="Contoh: KPU Kabupaten Sekadau"
              value={formData.instansi}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-3 bg-slate-800/90 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Jabatan / Peran <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              name="jabatan"
              placeholder="Contoh: Anggota / Peserta"
              value={formData.jabatan}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-3 bg-slate-800/90 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Mengirim & Menerbitkan Nomor...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Kirim Presensi Sekarang</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default FormPresensi;
