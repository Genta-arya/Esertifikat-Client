import React, { useEffect, useState } from "react";
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
  ShieldAlert,
  PencilLine,
  ChevronDown,
  Search,
  FileCheck2,
  Download,
  Clock3,
  RefreshCw,
  ClipboardPenLine,
  FileSearch,
  ExternalLink,
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

const CERTIFICATE_STATUS_LABELS = {
  QUEUED: "Sertifikat masuk antrean pemrosesan.",
  PROCESSING: "Sertifikat sedang dibuat oleh sistem.",
  RETRY_WAIT: "Sistem akan mencoba kembali mengirim sertifikat.",
  FAILED: "Sertifikat belum dapat diproses. Silakan hubungi panitia.",
  COMPLETED: "Sertifikat berhasil dibuat dan siap diunduh.",
};

const getDriveFileId = (fileId, fileUrl) => {
  if (fileId && String(fileId).trim()) {
    return String(fileId).trim();
  }

  if (!fileUrl || typeof fileUrl !== "string") {
    return "";
  }

  const filePathMatch = fileUrl.match(/\/file\/d\/([^/?]+)/);
  if (filePathMatch?.[1]) {
    return filePathMatch[1];
  }

  const queryIdMatch = fileUrl.match(/[?&]id=([^&/]+)/);
  if (queryIdMatch?.[1]) {
    return queryIdMatch[1];
  }

  return "";
};

const getDrivePreviewUrl = (fileId, fileUrl) => {
  const resolvedFileId = getDriveFileId(fileId, fileUrl);
  if (!resolvedFileId) return "";
  return `https://drive.google.com/file/d/${resolvedFileId}/preview`;
};

const getDriveViewUrl = (fileId, fileUrl) => {
  const resolvedFileId = getDriveFileId(fileId, fileUrl);
  if (!resolvedFileId) return fileUrl || "";
  return `https://drive.google.com/file/d/${resolvedFileId}/view`;
};

const getDriveDownloadUrl = (fileId, fileUrl) => {
  const resolvedFileId = getDriveFileId(fileId, fileUrl);
  if (!resolvedFileId) return "";
  return `https://drive.google.com/uc?export=download&id=${resolvedFileId}`;
};

const FormPresensi = () => {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const emailParam = searchParams.get("email")?.trim().toLowerCase();

  const [activeTab, setActiveTab] = useState(
    emailParam ? "sertifikat" : "presensi",
  );

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
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false); // Modal popup sukses presensi

  const [generatedNomor, setGeneratedNomor] = useState("");

  const [searchCertificateEmail, setSearchCertificateEmail] = useState(
    emailParam || "",
  );

  const [isSearchingCertificate, setIsSearchingCertificate] = useState(false);

  const [certificateResult, setCertificateResult] = useState(null);
  const [certificateSearchMessage, setCertificateSearchMessage] = useState("");

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
            where("slug", "==", slug),
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
          (field) => field.key === "instansi",
        );

        const configuredOptions = Array.isArray(instansiField?.options)
          ? instansiField.options
              .map((option) => String(option).trim())
              .filter(Boolean)
              .filter(
                (option) =>
                  option.toLowerCase() !==
                  OTHER_INSTITUTION_LABEL.toLowerCase(),
              )
          : [];

        setInstansiOptions(configuredOptions);

        if (emailParam) {
          const pesertaRef = collection(db, "kegiatan", docId, "peserta");

          const qEmail = query(pesertaRef, where("email", "==", emailParam));

          const pesertaSnap = await getDocs(qEmail);

          if (!pesertaSnap.empty) {
            const pesertaDoc = pesertaSnap.docs[0];
            const pesertaData = pesertaDoc.data();
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
            setSearchCertificateEmail(emailParam);

            setCertificateResult({
              id: pesertaDoc.id,
              ...pesertaData,
            });
          } else {
            toast.error(
              `Data peserta dengan email "${emailParam}" belum ditemukan.`,
            );

            setSearchParams({});
            setSearchCertificateEmail("");

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
      const pesertaRef = collection(db, "kegiatan", targetDocId, "peserta");

      // Menggunakan emailClean sebagai ID dokumen untuk pencegahan mutlak double absen
      const newPesertaDocRef = doc(pesertaRef, emailClean);
      const counterDocRef = doc(db, "counters", `sertifikat_${currentYear}`);
      const kegiatanRef = doc(db, "kegiatan", targetDocId);
      const kodeUndangan = kegiatan?.kodeUndangan || "KPU-SKD";

      let finalNomorResmi = "";

      await runTransaction(db, async (transaction) => {
        // Cek langsung di dalam transaksi apakah email sudah ada
        const existingPesertaSnap = await transaction.get(newPesertaDocRef);
        if (existingPesertaSnap.exists()) {
          throw new Error(
            "Email ini sudah pernah melakukan presensi untuk kegiatan tersebut.",
          );
        }

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
          instansiManual: selectedInstansi === OTHER_INSTITUTION_VALUE,
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
        emailClean,
      )}`;
      window.history.replaceState(null, "", newUrl);

      setGeneratedNomor(finalNomorResmi);

      setCertificateResult({
        nama: namaClean,
        email: emailClean,
        instansi: instansiClean,
        jabatan: jabatanClean,
        nomorSertifikat: finalNomorResmi,
        sertifikatTerkirim: false,
        certificateStatus: "QUEUED",
      });

      setSearchCertificateEmail(emailClean);
      // data set null
      setFormData({
        nama: "",
        email: "",
        instansi: "",
        jabatan: "",
      });
      setShowSuccessModal(true);

      toast.success("Presensi berhasil dikirim. E-Sertifikat sedang diproses.");
    } catch (error) {
      console.error("Gagal menyimpan presensi:", error);
      toast.error(
        error.message ||
          "Terjadi kesalahan saat menyimpan presensi. Silakan coba lagi.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

const handleSearchCertificate = async (event) => {
    event.preventDefault();
    const emailClean = searchCertificateEmail.trim().toLowerCase();

    if (!emailClean) {
      toast.error("Masukkan alamat email yang digunakan saat presensi.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailClean)) {
      toast.error("Format email tidak valid.");
      return;
    }

    if (!kegiatan?.id) {
      toast.error("Data kegiatan belum siap.");
      return;
    }

    setIsSearchingCertificate(true);
    setCertificateResult(null); // RESET state hasil agar card lama hilang
    setCertificateSearchMessage("");

    try {
      const pesertaRef = collection(db, "kegiatan", kegiatan.id, "peserta");
      const pesertaQuery = query(pesertaRef, where("email", "==", emailClean));
      const pesertaSnap = await getDocs(pesertaQuery);

      if (pesertaSnap.empty) {
        const notFoundMsg = "Data peserta tidak ditemukan. Pastikan email yang dimasukkan sama dengan email saat presensi.";
        
        setCertificateSearchMessage(notFoundMsg);
        setCertificateResult(null); 
        
        // TAMBAHKAN INI AGAR TOAST MUNCUL
        toast.error(notFoundMsg);
        
        return;
      }

      const pesertaDoc = pesertaSnap.docs[0];
      const pesertaData = pesertaDoc.data();

      // JIKA KETEMU: Masukkan data ke state
      setCertificateResult({
        id: pesertaDoc.id,
        ...pesertaData,
      });

      setGeneratedNomor(pesertaData.nomorSertifikat || "");

      const newUrl = `${window.location.pathname}?email=${encodeURIComponent(
        emailClean
      )}`;
      window.history.replaceState(null, "", newUrl);
    } catch (error) {
      console.error("Gagal mencari sertifikat:", error);
      const errMsg = "Terjadi kesalahan saat mencari sertifikat. Silakan coba lagi.";
      setCertificateSearchMessage(errMsg);
      setCertificateResult(null);
      toast.error(errMsg);
    } finally {
      setIsSearchingCertificate(false);
    }
  };

  const handleSwitchTab = (tab) => {
    setActiveTab(tab);
  };

if (loadingKegiatan) {
    return (
      <div className="min-h-screen bg-stone-100 text-slate-800 flex items-center justify-center p-4">
        <div className="bg-white border border-stone-200 shadow-xl rounded-2xl p-8 flex flex-col items-center gap-4 max-w-xs w-full text-center">
          <div className="relative flex items-center justify-center">
            {/* Lingkaran efek pulse / berdenyut di belakang logo */}
            <div className="absolute w-16 h-16 bg-red-100 rounded-full animate-ping opacity-75"></div>
            
            {/* Logo KPU */}
            <img
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQWP7A6s61nirGfyz19bMeseHVKbYY5HIGKkQh0ah3rGA&s"
              alt="Logo KPU"
              className="w-12 h-12 object-contain relative z-10"
            />
          </div>

          <div className="space-y-1">
            <h2 className="text-sm font-bold text-slate-900 tracking-wide">
              KPU KABUPATEN SEKADAU
            </h2>
            <p className="text-xs text-slate-500 animate-pulse">
              Memuat formulir kegiatan...
            </p>
          </div>

          {/* Indikator loading tambahan */}
          <div className="flex items-center gap-1.5 pt-1">
            <Loader2 className="w-4 h-4 text-red-700 animate-spin" />
            <span className="text-[11px] font-medium text-slate-400">Mohon tunggu sebentar</span>
          </div>
        </div>
      </div>
    );
  }

  if (kegiatanError) {
    return (
      <div className="min-h-screen bg-stone-100 text-slate-800 flex items-center justify-center p-4">
        
        <div className="bg-white border border-stone-200 rounded-2xl p-6 text-center max-w-sm w-full space-y-4 shadow-lg shadow-slate-900/5">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 text-red-700 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Presensi Tidak Tersedia
            </h2>
            <p className="text-xs text-slate-500 mt-1">{kegiatanError}</p>
          </div>
        </div>
      </div>
    );
  }

  const certificateStatus =
    certificateResult?.certificateStatus ||
    (certificateResult?.sertifikatTerkirim ? "COMPLETED" : "QUEUED");

  const driveFileId = getDriveFileId(
    certificateResult?.certificateDriveFileId,
    certificateResult?.certificateDriveUrl,
  );

  const certificatePreviewUrl = getDrivePreviewUrl(
    certificateResult?.certificateDriveFileId,
    certificateResult?.certificateDriveUrl,
  );

  const certificateViewUrl = getDriveViewUrl(
    certificateResult?.certificateDriveFileId,
    certificateResult?.certificateDriveUrl,
  );

  const certificateDownloadUrl = getDriveDownloadUrl(
    certificateResult?.certificateDriveFileId,
    certificateResult?.certificateDriveUrl,
  );

  const isCertificateReady =
    certificateStatus === "COMPLETED" &&
    Boolean(driveFileId) &&
    Boolean(certificatePreviewUrl);

  return (
    <div className="min-h-screen bg-stone-100 text-slate-800">
      {/* Modal Popup Sukses Berhasil Presensi */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden text-center p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Presensi Berhasil Dikirim!
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Data Anda telah tercatat dan e-sertifikat sedang diproses oleh
                sistem. Anda dapat melihat status atau mengunduhnya melalui menu{" "}
                <span className="font-semibold text-slate-700">
                  Cari Sertifikat
                </span>
                .
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSuccessModal(false)}
              className="w-full py-3 text-xs font-bold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Data Peserta */}
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
                KPU Kabupaten Sekadau
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
               KPU Kabupaten Sekadau
              </span>
              <h1 className="text-base font-bold text-slate-900 leading-snug mt-1">
                {kegiatan?.namaKegiatan}
              </h1>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Silakan isi presensi atau gunakan menu pencarian untuk melihat
                sertifikat yang telah diterbitkan.
              </p>
            </div>
          </div>
        </div>

        <div className="mx-4 mt-4 grid grid-cols-2 rounded-xl bg-stone-200 p-1">
          <button
            type="button"
            onClick={() => handleSwitchTab("presensi")}
            className={`min-h-11 rounded-lg px-3 py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === "presensi"
                ? "bg-white text-red-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ClipboardPenLine className="w-4 h-4" />
            Presensi
          </button>

          <button
            type="button"
            onClick={() => handleSwitchTab("sertifikat")}
            className={`min-h-11 rounded-lg px-3 py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === "sertifikat"
                ? "bg-white text-red-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileSearch className="w-4 h-4" />
            Cari Sertifikat
          </button>
        </div>

        {activeTab === "presensi" && (
          <form
            onSubmit={handleOpenConfirmation}
            className="mx-4 mt-4 bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-5"
          >
            <div className="flex items-center gap-2 pb-3 border-b border-stone-200">
              <span className="w-6 h-6 rounded-full animate-pulse bg-red-700 text-white text-[11px] font-bold flex items-center justify-center">
                1
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900">Data Peserta</p>
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
        )}

        {activeTab === "sertifikat" && (
          <section className="mx-4 mt-4 space-y-4">
            <form
              onSubmit={handleSearchCertificate}
              className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 shrink-0 rounded-lg bg-red-50 border border-red-100 text-red-700 flex items-center justify-center">
                  <FileSearch className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Cari E-Sertifikat
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Masukkan email yang digunakan ketika mengisi presensi.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Alamat Email Peserta
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    value={searchCertificateEmail}
                    onChange={(event) =>
                      setSearchCertificateEmail(event.target.value)
                    }
                    placeholder="nama@email.com"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-stone-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSearchingCertificate}
                className="w-full py-3 text-white bg-red-700 hover:bg-red-800 transition-colors disabled:opacity-60 font-bold rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSearchingCertificate ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Mencari Sertifikat...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Cari Sertifikat
                  </>
                )}
              </button>
            </form>

         

            {certificateResult && (
              <>
                {isCertificateReady ? (
                  <>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                      <p className="text-xs text-emerald-900 leading-relaxed">
                        E-Sertifikat telah tersedia. Anda dapat melihat dokumen di
                        bawah ini atau mengunduh file PDF.
                      </p>
                    </div>

                    <div className="rounded-xl overflow-hidden border border-stone-300 bg-stone-100">
                      <iframe
                        src={certificatePreviewUrl}
                        title={`E-Sertifikat ${certificateResult.nama || ""}`}
                        className="w-full h-[560px] border-0"
                        allow="autoplay"
                        loading="lazy"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {certificateViewUrl ? (
                        <a
                          href={certificateViewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="py-3 px-3 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Buka Drive
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="py-3 px-3 bg-slate-200 text-slate-400 text-xs font-bold rounded-lg flex items-center justify-center gap-2 cursor-not-allowed"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Drive Tidak Tersedia
                        </button>
                      )}

                      {certificateDownloadUrl ? (
                        <a
                          href={certificateDownloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="py-3 px-3 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Unduh PDF
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="py-3 px-3 bg-slate-200 text-slate-400 text-xs font-bold rounded-lg flex items-center justify-center gap-2 cursor-not-allowed"
                        >
                          <Download className="w-4 h-4" />
                          File Belum Tersedia
                        </button>
                      )}
                    </div>
                  </>
                ) : certificateStatus === "COMPLETED" ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-amber-900">
                        Sertifikat selesai diproses, tetapi file belum tersedia.
                      </p>
                      <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                        Silakan coba kembali beberapa saat lagi atau hubungi panitia
                        kegiatan.
                      </p>
                    </div>
                  </div>
                ) : certificateStatus === "FAILED" ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-700 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-red-900">
                        Pengiriman Sertifikat Gagal
                      </p>
                      <p className="text-xs text-red-800 mt-1 leading-relaxed">
                        Sistem mendapati kendala saat mengirim email ke alamat yang
                        Anda daftarkan (kemungkinan alamat email salah ketik, tidak
                        aktif, atau penuh).
                      </p>
                      <p className="text-xs text-red-800 mt-2 leading-relaxed">
                        Silakan hubungi panitia kegiatan melalui WhatsApp di{" "}
                        <a
                          href="https://wa.me/6282197085204"
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold underline text-red-700 hover:text-red-900"
                        >
                          0821-9708-5204
                        </a>{" "}
                        untuk bantuan perbaikan email atau pengiriman ulang.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2">
                    <RefreshCw className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-amber-900">
                        Sertifikat Sedang Dalam Antrean / Diproses
                      </p>
                      <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                        Sistem sedang memproses dokumen dan pengiriman email Anda.
                        Silakan muat ulang beberapa saat lagi.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        <footer className="px-4 pt-6 text-center">
          <div className="h-px bg-stone-200 mb-4" />
          <p className="text-[10px] text-slate-500">
            © {new Date().getFullYear()} Komisi Pemilihan Umum Kabupaten Sekadau
          </p>
        </footer>
      </main>
    </div>
  );
};

export default FormPresensi;
