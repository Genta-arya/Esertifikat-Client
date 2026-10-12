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
  MailCheck,
  ShieldAlert,
  PencilLine,
  ChevronDown,
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

const OTHER_INSTITUTION_VALUE = "__LAINNYA__";
const OTHER_INSTITUTION_LABEL = "Lainnya";

const KPU_LOGO_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/KPU_Logo.svg/1920px-KPU_Logo.svg.png";

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

  const [selectedInstansi, setSelectedInstansi] = useState("");
  const [instansiLainnya, setInstansiLainnya] = useState("");
  const [instansiOptions, setInstansiOptions] = useState([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedNomor, setGeneratedNomor] = useState("");
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
        const docSnap = await getDoc(docRef);

        let data = null;
        let docId = slug;

        if (docSnap.exists()) {
          data = docSnap.data();
        } else {
          const kegiatanQuery = query(
            collection(db, "kegiatan"),
            where("slug", "==", slug)
          );

          const querySnap = await getDocs(kegiatanQuery);

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

        setKegiatan({
          id: docId,
          ...data,
        });

        const formFields = data?.formConfig?.fields || [];

        const instansiField = formFields.find(
          (field) => field.key === "instansi"
        );

        const configuredOptions = Array.isArray(instansiField?.options)
          ? instansiField.options
              .map((option) => String(option).trim())
              .filter(Boolean)
              .filter(
                (option) =>
                  option.toLowerCase() !==
                  OTHER_INSTITUTION_LABEL.toLowerCase()
              )
          : [];

        setInstansiOptions(configuredOptions);

        if (emailParam) {
          const pesertaRef = collection(
            db,
            "kegiatan",
            docId,
            "peserta"
          );

          const qEmail = query(
            pesertaRef,
            where("email", "==", emailParam)
          );

          const pesertaSnap = await getDocs(qEmail);

          if (!pesertaSnap.empty) {
            const pesertaData = pesertaSnap.docs[0].data();
            const savedInstansi = pesertaData.instansi || "";

            setFormData({
              nama: pesertaData.nama || "",
              email: pesertaData.email || emailParam,
              instansi: savedInstansi,
              jabatan: pesertaData.jabatan || "",
            });

            if (
              configuredOptions.length > 0 &&
              savedInstansi &&
              !configuredOptions.includes(savedInstansi)
            ) {
              setSelectedInstansi(OTHER_INSTITUTION_VALUE);
              setInstansiLainnya(savedInstansi);
            } else {
              setSelectedInstansi(savedInstansi);
              setInstansiLainnya("");
            }

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

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleInstansiChange = (event) => {
    const value = event.target.value;

    setSelectedInstansi(value);

    if (value === OTHER_INSTITUTION_VALUE) {
      setFormData((prev) => ({
        ...prev,
        instansi: "",
      }));

      setInstansiLainnya("");
      return;
    }

    setInstansiLainnya("");

    setFormData((prev) => ({
      ...prev,
      instansi: value,
    }));
  };

  const handleInstansiLainnyaChange = (event) => {
    const value = event.target.value;

    setInstansiLainnya(value);

    setFormData((prev) => ({
      ...prev,
      instansi: value,
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

    if (selectedInstansi === OTHER_INSTITUTION_VALUE) {
      if (!instansiLainnya.trim()) {
        toast.error("Silakan tulis nama instansi atau lembaga Anda.");
        return false;
      }

      return true;
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

  const handleOpenConfirmation = (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

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

      const pesertaRef = collection(
        db,
        "kegiatan",
        targetDocId,
        "peserta"
      );

      const kodeUndangan = kegiatan?.kodeUndangan || "KPU-SKD";

      const counterDocRef = doc(
        db,
        "counters",
        `sertifikat_${currentYear}`
      );

      const newPesertaDocRef = doc(pesertaRef);
      const kegiatanRef = doc(db, "kegiatan", targetDocId);

      let finalNomorResmi = "";

      await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterDocRef);
        const kegiatanSnap = await transaction.get(kegiatanRef);

        if (!kegiatanSnap.exists()) {
          throw new Error("Dokumen kegiatan tidak ditemukan.");
        }

        const currentLast = counterSnap.exists()
          ? counterSnap.data().lastNumber || 0
          : 0;

        const nextNum = currentLast + 1;
        const formattedNum = String(nextNum).padStart(4, "0");

        finalNomorResmi =
          `${formattedNum}/${kodeUndangan}/${currentYear}`;

        const currentTotal =
          kegiatanSnap.data()?.totalPeserta || 0;

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
          instansiManual:
            selectedInstansi === OTHER_INSTITUTION_VALUE,
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

      const newUrl = `${window.location.pathname}?email=${encodeURIComponent(
        emailClean
      )}`;

      window.history.replaceState(null, "", newUrl);

      setGeneratedNomor(finalNomorResmi);
      setIsSuccess(true);

      toast.success(
        "Presensi berhasil dikirim. E-Sertifikat akan dikirim ke email Anda."
      );
    } catch (error) {
      console.error("Gagal menyimpan presensi:", error);

      toast.error(
        error.message ||
          "Terjadi kesalahan saat menyimpan presensi. Silakan coba lagi."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingKegiatan) {
    return (
      <div className="min-h-screen bg-stone-100 text-slate-800 flex items-center justify-center p-4">
        <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-6 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-red-700 animate-spin" />
          <p className="text-sm text-slate-600">
            Memuat formulir presensi...
          </p>
        </div>
      </div>
    );
  }

  if (kegiatanError) {
    return (
      <div className="min-h-screen bg-stone-100 text-slate-800 flex items-center justify-center p-4">
        <Toaster position="top-center" richColors />

        <div className="bg-white border border-stone-200 rounded-2xl p-6 text-center max-w-sm w-full space-y-4 shadow-lg shadow-slate-900/5">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 text-red-700 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-900">
              Presensi Tidak Tersedia
            </h2>

            <p className="text-xs text-slate-500 mt-1">
              {kegiatanError}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-stone-100 text-slate-800 flex items-center justify-center p-4">
        <Toaster position="top-center" richColors />

        <div className="bg-white border border-stone-200 rounded-2xl p-6 text-center max-w-sm w-full space-y-4 shadow-xl shadow-slate-900/5">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
            <MailCheck className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-red-700">
              KPU Kabupaten Sekadau
            </p>

            <h2 className="text-lg font-bold text-slate-900">
              {emailParam ? "Sertifikat Ditemukan" : "Presensi Berhasil"}
            </h2>

            <p className="text-xs text-slate-600">
              Halo,{" "}
              <span className="text-red-700 font-semibold">
                {formData.nama}
              </span>
              .
            </p>
          </div>

          <div className="bg-stone-50 rounded-xl p-4 text-xs text-slate-600 space-y-3 text-left border border-stone-200">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Kegiatan</span>
              <span className="font-semibold text-slate-800 text-right">
                {kegiatan?.namaKegiatan}
              </span>
            </div>

            <div className="h-px bg-stone-200" />

            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Nomor Sertifikat</span>
              <span className="font-mono text-red-700 font-bold text-right">
                {generatedNomor}
              </span>
            </div>

            <div className="h-px bg-stone-200" />

            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Email</span>
              <span className="font-medium text-slate-800 text-right break-all">
                {formData.email}
              </span>
            </div>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-left">
            <div className="flex items-start gap-2">
              <MailCheck className="w-4 h-4 text-red-700 mt-0.5 flex-shrink-0" />

              <p className="text-xs text-red-900 leading-relaxed">
                E-Sertifikat sedang diproses otomatis dan akan dikirim ke:
                <br />
                <span className="font-semibold">{formData.email}</span>
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />

              <p className="text-xs text-amber-900 leading-relaxed">
                Periksa folder <span className="font-semibold">Inbox</span>{" "}
                dan <span className="font-semibold">Spam/Junk</span> jika
                email belum diterima dalam beberapa menit.
              </p>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Anda boleh menutup halaman ini. Proses sertifikat tetap berjalan di
            server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 text-slate-800">
      <Toaster position="top-center" richColors />

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="h-1.5 bg-red-700" />

            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 text-red-700 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Konfirmasi Data Peserta
                  </h3>

                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Pastikan nama dan email benar. Data akan digunakan untuk
                    penerbitan serta pengiriman e-sertifikat.
                  </p>
                </div>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl divide-y divide-stone-200 text-xs">
                <div className="grid grid-cols-[90px_1fr] gap-3 p-3">
                  <span className="text-slate-500">Nama</span>
                  <span className="font-semibold text-slate-800 text-right break-words">
                    {formData.nama}
                  </span>
                </div>

                <div className="grid grid-cols-[90px_1fr] gap-3 p-3">
                  <span className="text-slate-500">Email</span>
                  <span className="font-semibold text-slate-800 text-right break-all">
                    {formData.email}
                  </span>
                </div>

                <div className="grid grid-cols-[90px_1fr] gap-3 p-3">
                  <span className="text-slate-500">Instansi</span>
                  <span className="font-semibold text-slate-800 text-right break-words">
                    {formData.instansi}
                  </span>
                </div>

                <div className="grid grid-cols-[90px_1fr] gap-3 p-3">
                  <span className="text-slate-500">Jabatan</span>
                  <span className="font-semibold text-slate-800 text-right break-words">
                    {formData.jabatan}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Setelah dikirim, data presensi dan nomor sertifikat akan
                diterbitkan. Pastikan tidak ada kesalahan penulisan.
              </p>
            </div>

            <div className="grid grid-cols-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="py-3.5 text-xs font-semibold text-slate-600 hover:bg-stone-50 transition-colors disabled:opacity-50"
              >
                Periksa Lagi
              </button>

              <button
                type="button"
                onClick={handleSubmitPresensi}
                disabled={isSubmitting}
                className="py-3.5 text-xs font-bold text-white bg-red-700 hover:bg-red-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Kirim Presensi
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      

      <main className="max-w-xl mx-auto pb-10">
        {kegiatan?.bannerUrl ? (
          <div className="px-4 pt-4">
            <img
              src={kegiatan.bannerUrl}
              alt={kegiatan.namaKegiatan}
              className="w-full max-h-80 object-cover rounded-xl border border-stone-200 shadow-sm"
            />
          </div>
        ) : (
          <div className="mx-4 mt-4 rounded-xl overflow-hidden border border-red-900">
            <div className="bg-red-700 px-5 py-6 text-center">
              <p className="text-[10px] tracking-[0.16em] font-bold uppercase text-red-100">
                Formulir Kehadiran
              </p>
              <h2 className="mt-2 text-base font-bold text-white">
                {kegiatan?.namaKegiatan}
              </h2>
            </div>
          </div>
        )}

        <div className="mx-4 mt-4 bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 shrink-0 rounded-lg bg-red-50 border border-red-100 text-red-700 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>

            <div>
              <span className="text-[10px] font-bold text-red-700 uppercase tracking-[0.13em]">
                Formulir Kehadiran
              </span>

              <h2 className="text-base font-bold text-slate-900 leading-snug mt-1">
                {kegiatan?.namaKegiatan}
              </h2>

              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Silakan lengkapi data diri dengan benar. Data digunakan untuk
                penerbitan dan pengiriman e-sertifikat.
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleOpenConfirmation}
          className="mx-4 mt-4 bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-5"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-stone-200">
            <span className="w-6 h-6 animate-pulse rounded-full bg-red-700 text-white text-[11px] font-bold flex items-center justify-center">
              1
            </span>

            <div>
              <p className="text-sm font-bold text-slate-900">
                Data Peserta
              </p>
              <p className="text-[11px] text-slate-500">
                Kolom bertanda bintang wajib diisi.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Nama Lengkap <span className="text-red-700">*</span>
            </label>

            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />

              <input
                type="text"
                name="nama"
                maxLength={60}
                placeholder="Contoh: Dr. Nama Peserta"
                value={formData.nama}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 bg-white border border-stone-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700 transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Alamat Email <span className="text-red-700">*</span>
            </label>

            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />

              <input
                type="email"
                name="email"
                placeholder="nama@email.com"
                value={formData.email}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 bg-white border border-stone-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700 transition-all"
                required
              />
            </div>

            <p className="text-[10px] text-slate-500">
              E-sertifikat akan dikirim ke alamat email ini.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Instansi / Lembaga <span className="text-red-700">*</span>
            </label>

            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 z-10 pointer-events-none" />

              {instansiOptions.length > 0 ? (
                <>
                  <select
                    name="instansi"
                    value={selectedInstansi}
                    onChange={handleInstansiChange}
                    className="appearance-none w-full pl-10 pr-10 py-3 bg-white border border-stone-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700 transition-all"
                    required
                  >
                    <option value="">Pilih Instansi / Lembaga</option>

                    {instansiOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}

                    <option value={OTHER_INSTITUTION_VALUE}>
                      {OTHER_INSTITUTION_LABEL}
                    </option>
                  </select>

                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                </>
              ) : (
                <input
                  type="text"
                  name="instansi"
                  placeholder="Contoh: KPU Kabupaten Sekadau"
                  value={formData.instansi}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-stone-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700 transition-all"
                  required
                />
              )}
            </div>

            {instansiOptions.length > 0 &&
              selectedInstansi === OTHER_INSTITUTION_VALUE && (
                <div className="relative pt-1">
                  <PencilLine className="w-4 h-4 text-red-700 absolute left-3.5 top-4" />

                  <input
                    type="text"
                    name="instansiLainnya"
                    value={instansiLainnya}
                    onChange={handleInstansiLainnyaChange}
                    maxLength={120}
                    placeholder="Tulis nama instansi / lembaga Anda"
                    className="w-full pl-10 pr-4 py-3 bg-red-50/40 border border-red-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700 transition-all"
                    required
                    autoFocus
                  />
                </div>
              )}

            {instansiOptions.length > 0 && (
              <p className="text-[10px] text-slate-500">
                Jika instansi tidak tersedia dalam daftar, pilih{" "}
                <span className="font-semibold text-red-700">Lainnya</span>.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Jabatan / Peran <span className="text-red-700">*</span>
            </label>

            <div className="relative">
              <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />

              <input
                type="text"
                name="jabatan"
                placeholder="Contoh: Anggota / Peserta"
                value={formData.jabatan}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 bg-white border border-stone-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700 transition-all"
                required
              />
            </div>
          </div>

          <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-red-700 mt-0.5 shrink-0" />

            <p className="text-[10px] text-slate-600 leading-relaxed">
              Pastikan nama dan email sudah benar sebelum mengirim presensi.
              Data tersebut akan digunakan pada e-sertifikat dan proses
              pengiriman email.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-red-700 hover:bg-red-800 text-white font-bold rounded-lg shadow-md shadow-red-900/15 flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Menyimpan Presensi...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Kirim Presensi</span>
              </>
            )}
          </button>
        </form>

        <footer className="px-4 pt-6 text-center">
          <div className="h-px bg-stone-200 mb-4" />
          <p className="text-[10px] text-slate-500">
            © {new Date().getFullYear()} Komisi Pemilihan Umum Kabupaten
            Sekadau
          </p>
        </footer>
      </main>
    </div>
  );
};

export default FormPresensi;