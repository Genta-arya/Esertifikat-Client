import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { UploadImage } from "../../services/AxiosInstance";

// Import Firestore SDK
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

// Import Sub-Components
import KegiatanName from "../../components/CreateKegiatan/KegiatanName";
import SlugURL from "../../components/CreateKegiatan/SlugURL";
import CertificateNumberFormat from "../../components/CreateKegiatan/CertificateNumberFormat";
import QRCodePreview from "../../components/CreateKegiatan/QRCodePreview";
import BannerUpload from "../../components/CreateKegiatan/BannerUpload";
import TemplateUpload from "../../components/CreateKegiatan/TemplateUpload";
import PublicFormInfo from "../../components/CreateKegiatan/PublicFormInfo";
import SubmitButton from "../../components/CreateKegiatan/SubmitButton";
import { db } from "../../utils/Firebase";
import { toast, Toaster } from "sonner"; // Impor Toaster untuk pemastian lokal jika belum ada di root

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB

const CreateKegiatan = () => {
  const navigate = useNavigate();

  // State Form Utama
  const [namaKegiatan, setNamaKegiatan] = useState("");
  const [slug, setSlug] = useState("");
 
  const [currentYear, setCurrentYear] = useState(
    new Date().getFullYear().toString(),
  );
  // State Nomor Sertifikat & Bank Data
  const [kodeUndangan, setKodeUndangan] = useState("");

  const [estimatedNextNum, setEstimatedNextNum] = useState("0001");
  const [loadingCounter, setLoadingCounter] = useState(true);

  // State Banner
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");

  // State Template Sertifikat
  const [templateFile, setTemplateFile] = useState(null);
  const [templateUrl, setTemplateUrl] = useState("");

  // Status Loading & Utility
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form Public Full URL
  const publicFormUrl = slug
    ? `${window.location.origin}/kegiatan/${slug}`
    : "";

  // 1. CEK BANK DATA NOMOR TERAKHIR
  const fetchBankDataCounter = async () => {
    setLoadingCounter(true);
    try {
      const counterDocRef = doc(db, "counters", `sertifikat_${currentYear}`);
      const counterSnap = await getDoc(counterDocRef);

      if (counterSnap.exists()) {
        const lastNumber = counterSnap.data().lastNumber || 0;
        setEstimatedNextNum(String(lastNumber + 1).padStart(4, "0"));
      } else {
        setEstimatedNextNum("0001");
      }
    } catch (err) {
      console.error("Error fetching bank data counter:", err);
      setEstimatedNextNum("0001");
    } finally {
      setLoadingCounter(false);
    }
  };

  useEffect(() => {
    fetchBankDataCounter();
  }, [currentYear]);

  // Auto Generate Slug
  const handleNamaChange = (e) => {
    const val = e.target.value;
    setNamaKegiatan(val);

    const generatedSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    setSlug(generatedSlug);
  };

  // Select Banner
  const handleSelectBanner = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Ukuran file banner melebihi batas 3MB!");
      e.target.value = null;
      return;
    }
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
    setBannerUrl("");
  };

  // Select Template (Pengecekan Validasi Ekstensi & MIME)
  const handleSelectTemplate = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isPptxExtension =
      fileName.endsWith(".pptx") || fileName.endsWith(".ppt");
    const validMimeTypes = [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint",
    ];

    const isValidFormat = isPptxExtension || validMimeTypes.includes(file.type);

    if (!isValidFormat) {
      toast.error("Format file template sertifikat harus PPTX atau PPT!");
      e.target.value = null;
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Ukuran file template sertifikat melebihi batas 3MB!");
      e.target.value = null;
      return;
    }

    setTemplateFile(file);
    setTemplateUrl("");
  };

  // Upload ke Cloud
  const uploadToCloud = async (fileToUpload) => {
    if (!fileToUpload) return null;

    try {
      const response = await UploadImage(fileToUpload);
      const uploadedUrl =
        response?.file_url ||
        response?.url ||
        response?.data?.url ||
        response?.data?.file_url ||
        (typeof response === "string" ? response : null);

      if (!uploadedUrl) throw new Error("URL hasil upload tidak ditemukan.");
      return uploadedUrl;
    } catch (error) {
      console.error("Upload Error:", error);
      toast.error(`Gagal mengunggah ${fileToUpload.name} ke cloud server.`);
      return null;
    }
  };

  const handleCopyLink = () => {
    if (!publicFormUrl) return;
    navigator.clipboard.writeText(publicFormUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    const svgElement = document.getElementById("kpu-qrcode-svg");
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = 1000;
      canvas.height = 1000;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, 1000, 1000);

      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR-${slug || "kegiatan"}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src =
      "data:image/svg+xml;base64," +
      btoa(unescape(encodeURIComponent(svgData)));
  };

  // SUBMIT FORM
// SUBMIT FORM
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!namaKegiatan || !slug)
      return toast.info("Nama Kegiatan & Slug wajib diisi!");
    if (!kodeUndangan.trim())
      return toast.info("Format Kode Sertifikat wajib diisi!");

    setIsSubmitting(true);
    setIsUploading(true);

    try {
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

      const cleanKode = kodeUndangan.trim().toUpperCase();
      const counterDocRef = doc(db, "counters", `sertifikat_${currentYear}`);
      const kegiatanDocRef = doc(db, "kegiatan", slug);

      let finalAssignedNumber = "";

      await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterDocRef);
        const currentLast = counterSnap.exists()
          ? counterSnap.data().lastNumber || 0
          : 0;

        const inputNum = parseInt(estimatedNextNum, 10);

        // VALIDASI: Jika nomor urut yang diinput admin lebih kecil atau sama dengan counter terakhir yang sudah terpakai
        if (isNaN(inputNum) || inputNum <= currentLast) {
          throw new Error(
            `Nomor urut "${estimatedNextNum}" sudah terpakai atau tidak valid! Nomor urut terakhir saat ini adalah ${String(currentLast).padStart(4, "0")}. Gunakan nomor setelahnya.`
          );
        }

        const nextNumVal = inputNum;
        finalAssignedNumber = String(nextNumVal).padStart(4, "0");

        transaction.set(
          counterDocRef,
          {
            lastNumber: nextNumVal,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        transaction.set(kegiatanDocRef, {
          namaKegiatan,
          slug,
          kodeUndangan: cleanKode,
          startingNumber: finalAssignedNumber,
          bannerUrl: finalBannerUrl || "",
          templateUrl: finalTemplateUrl || "",
          formFields: ["nama", "email", "instansi", "jabatan"],
          totalPeserta: 0,
          terkirim: 0,
          aktif: true,
          createdAt: serverTimestamp(),
        });
      });

      toast.success(`Kegiatan "${namaKegiatan}" berhasil disimpan!`);
      navigate("/admin/dashboard");
    } catch (error) {
      console.error("Firestore Transaction Error:", error);
      toast.error(error.message || "Terjadi kesalahan saat menyimpan data.");
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col mx-auto shadow-2xl border-x border-slate-800 relative">
      {/* Menambahkan Toaster untuk menjamin Toast Sonner muncul */}
      

      <header className="bg-slate-800/80 backdrop-blur-md p-4 sticky top-0 z-20 border-b border-slate-700/50 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-slate-700/50 hover:bg-slate-700 text-slate-200 rounded-xl transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-bold leading-tight">
            Buat Kegiatan Baru
          </h1>
          <p className="text-xs text-slate-400">
            Atur judul, nomor sertifikat, banner, & QR Code
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 p-4 pb-28 space-y-5">
        <KegiatanName
          namaKegiatan={namaKegiatan}
          handleNamaChange={handleNamaChange}
        />

        <SlugURL
          slug={slug}
          setSlug={setSlug}
          publicFormUrl={publicFormUrl}
          handleCopyLink={handleCopyLink}
          copied={copied}
        />

        <CertificateNumberFormat
          kodeUndangan={kodeUndangan}
          setKodeUndangan={setKodeUndangan}
          loadingCounter={loadingCounter}
          setCurrentYear={setCurrentYear}
          setEstimatedNextNum={setEstimatedNextNum}
          estimatedNextNum={estimatedNextNum}
          currentYear={currentYear}
          fetchBankDataCounter={fetchBankDataCounter}
        />

        <QRCodePreview
          slug={slug}
          publicFormUrl={publicFormUrl}
          handleDownloadQR={handleDownloadQR}
        />

        <BannerUpload
          bannerFile={bannerFile}
          bannerPreview={bannerPreview}
          onSelectBanner={handleSelectBanner}
        />

        {/* PERBAIKAN: Menyamakan nama prop 'onSelectTemplate' */}
        <TemplateUpload
          templateFile={templateFile}
          onSelectTemplate={handleSelectTemplate}
        />

        <PublicFormInfo />

        <SubmitButton
          isSubmitting={isSubmitting}
          isUploading={isUploading}
          loadingCounter={loadingCounter}
        />
      </form>
    </div>
  );
};

export default CreateKegiatan;
