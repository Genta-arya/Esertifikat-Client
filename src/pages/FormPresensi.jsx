import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  User,
  Mail,
  Building2,
  Briefcase,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  X,
  MailCheck,
  ShieldAlert,
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
import { Toaster, toast } from "sonner";

const FormPresensi = () => {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const emailParam = searchParams.get("email")?.trim().toLowerCase();

  const [kegiatan, setKegiatan] = useState(null);
  const [loadingKegiatan, setLoadingKegiatan] = useState(true);
  const [kegiatanError, setKegiatanError] = useState("");

  const [formData, setFormData] = useState({
    nama: "",
    email: emailParam || "",
    instansi: "",
    jabatan: "",
  });

  const [instansiOptions, setInstansiOptions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedNomor, setGeneratedNomor] = useState("");

  // Modal konfirmasi sebelum submit
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const currentYear = new Date().getFullYear();

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
            where("slug", "==", slug)
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

        const formFields = data?.formConfig?.fields || [];
        const instansiField = formFields.find(
          (field) => field.key === "instansi"
        );

        setInstansiOptions(instansiField?.options || []);

        if (emailParam) {
          const pesertaRef = collection(db, "kegiatan", docId, "peserta");
          const qEmail = query(
            pesertaRef,
            where("email", "==", emailParam)
          );

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
            toast.error(
              `Sertifikat dengan email "${emailParam}" belum terdaftar atau belum melakukan presensi.`
            );

            setSearchParams({});
            setFormData((prev) => ({
              ...prev,
              email: "",
            }));
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
  }, [slug, emailParam, setSearchParams]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    const namaClean = formData.nama.trim();
    const emailClean = formData.email.trim().toLowerCase();
    const instansiClean = formData.instansi.trim();
    const jabatanClean = formData.jabatan.trim();

    if (!namaClean || !emailClean || !instansiClean || !jabatanClean) {
      toast.error("Mohon lengkapi semua data terlebih dahulu.");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(emailClean)) {
      toast.error("Format email tidak valid.");
      return false;
    }

    if (!kegiatan?.id) {
      toast.error("Data kegiatan tidak valid.");
      return false;
    }

    if (
      instansiOptions.length > 0 &&
      !instansiOptions.includes(instansiClean)
    ) {
      toast.error("Pilihan instansi tidak valid.");
      return false;
    }

    return true;
  };

  const handleOpenConfirmation = (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setShowConfirmModal(true);
  };

  const handleSubmitPresensi = async () => {
    setShowConfirmModal(false);
    setIsSubmitting(true);

    const namaClean = formData.nama.trim();
    const emailClean = formData.email.trim().toLowerCase();
    const instansiClean = formData.instansi.trim();
    const jabatanClean = formData.jabatan.trim();

    try {
      const targetDocId = kegiatan.id;
      const pesertaRef = collection(db, "kegiatan", targetDocId, "peserta");

      const checkEmailQuery = query(
        pesertaRef,
        where("email", "==", emailClean)
      );

      const existingPeserta = await getDocs(checkEmailQuery);

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
          { merge: true }
        );

        transaction.set(newPesertaDocRef, {
          nama: namaClean,
          email: emailClean,
          instansi: instansiClean,
          jabatan: jabatanClean,
          nomorSertifikat: finalNomorResmi,
          sertifikatTerkirim: false,
          certificateStatus: "QUEUED",
          waktuPresensi: serverTimestamp(),
        });

        transaction.update(kegiatanRef, {
          totalPeserta: currentTotal + 1,
        });
      });

      const newUrl = `${window.location.pathname}?email=${emailClean}`;
      window.history.replaceState(null, "", newUrl);

      setGeneratedNomor(finalNomorResmi);
      setIsSuccess(true);

      toast.success(
        "Presensi berhasil dikirim. E-Sertifikat akan dikirim ke email Anda."
      );
    } catch (error) {
      console.error("Gagal menyimpan presensi:", error);
      toast.error(
        "Terjadi kesalahan saat menyimpan presensi. Silakan coba lagi."
      );
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
        <Toaster position="top-center" richColors />

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
        <Toaster position="top-center" richColors />

        <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 text-center max-w-sm w-full space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 flex items-center justify-center mx-auto">
            <MailCheck className="w-8 h-8" />
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
              <span className="font-mono text-slate-200">
                {formData.email}
              </span>
            </p>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-left">
            <div className="flex items-start gap-2">
              <MailCheck className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />

              <p className="text-xs text-blue-100 leading-relaxed">
                E-Sertifikat Anda sedang diproses secara otomatis dan akan
                dikirim ke email:
                <br />
                <span className="font-semibold text-white">
                  {formData.email}
                </span>
                .
              </p>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-left">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />

              <p className="text-xs text-amber-100 leading-relaxed">
                Pastikan email Anda aktif dan periksa folder{" "}
                <span className="font-semibold">Spam/Junk</span> jika email
                belum diterima dalam beberapa menit.
              </p>
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            Anda sudah boleh menutup halaman ini. Proses sertifikat tetap
            berjalan di server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col mx-auto shadow-2xl border-x border-slate-800 relative">
      
      {/* Modal Konfirmasi */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white">
                    Pastikan Data Anda Sudah Benar
                  </h3>

                  <p className="text-xs text-slate-400 mt-1">
                    Data ini akan digunakan untuk penerbitan dan pengiriman
                    e-sertifikat.
                  </p>
                </div>
              </div>

              <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400">Nama</span>
                  <span className="font-semibold text-white text-right">
                    {formData.nama}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-slate-400">Email</span>
                  <span className="font-semibold text-white text-right break-all">
                    {formData.email}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-slate-400">Instansi</span>
                  <span className="font-semibold text-white text-right">
                    {formData.instansi}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-slate-400">Jabatan</span>
                  <span className="font-semibold text-white text-right">
                    {formData.jabatan}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Pastikan <span className="text-white font-semibold">nama</span>{" "}
                dan{" "}
                <span className="text-white font-semibold">email</span> sudah
                benar. E-Sertifikat akan dikirim ke email tersebut.
              </p>
            </div>

            <div className="grid grid-cols-2 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="py-3 text-xs font-semibold text-slate-300 hover:bg-slate-700/50 transition-colors disabled:opacity-50"
              >
                Periksa Lagi
              </button>

              <button
                type="button"
                onClick={handleSubmitPresensi}
                disabled={isSubmitting}
                className="py-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Ya, Kirim Sekarang
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {kegiatan?.bannerUrl ? (
        <img
          src={kegiatan.bannerUrl}
          alt={kegiatan.namaKegiatan}
          className="w-full object-cover border-b border-slate-700/60 shadow-lg"
        />
      ) : (
        <div className="w-full h-24 bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex items-center justify-center text-center">
          <h2 className="text-sm font-bold text-white">
            {kegiatan?.namaKegiatan}
          </h2>
        </div>
      )}

      <div className="space-y-3 px-4 mb-4 mt-8">
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

      <form
        onSubmit={handleOpenConfirmation}
        className="p-4 pt-0 space-y-4 flex-1 pb-10"
      >
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
            <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 z-10" />

            {instansiOptions.length > 0 ? (
              <select
                name="instansi"
                value={formData.instansi}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 bg-slate-800/90 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                required
              >
                <option value="">Pilih Instansi / Lembaga</option>

                {instansiOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                name="instansi"
                placeholder="Contoh: KPU Kabupaten Sekadau"
                value={formData.instansi}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 bg-slate-800/90 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                required
              />
            )}
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
              <span>Menyimpan Presensi...</span>
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