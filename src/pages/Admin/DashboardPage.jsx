import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import {
  Plus,
  Search,
  ShieldCheck,
  LogOut,
  Calendar,
  Sparkles,
  Trash2,
  ExternalLink,
  Loader2,
  QrCode,
  ChevronDown,
  ChevronUp,
  UserCheck,
  FileSpreadsheet,
  CheckCircle2,
  Clock3,
  XCircle,
  RotateCcw,
  AlertCircle,
  Mail,
  RefreshCw,
  Download,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import * as XLSX from "xlsx";

import {
  collection,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  increment,
  getDocs,
} from "firebase/firestore";
import { db, auth } from "../../utils/Firebase";
import { toast } from "sonner";
import ImportCsvModal from "./ImportCsvModal";

const KPU_LOGO_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/KPU_Logo.svg/1920px-KPU_Logo.svg.png";

const BACKEND_API_URL = "https://esertifikat.apiservices.my.id";

const CERTIFICATE_STATUS = {
  QUEUED: {
    label: "Menunggu",
    icon: Clock3,
    className:
      "bg-amber-500/10 text-amber-300 border-amber-500/30",
  },
  PROCESSING: {
    label: "Diproses",
    icon: Loader2,
    className:
      "bg-blue-500/10 text-blue-300 border-blue-500/30",
  },
  COMPLETED: {
    label: "Terkirim",
    icon: CheckCircle2,
    className:
      "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  },
  FAILED: {
    label: "Gagal",
    icon: XCircle,
    className:
      "bg-red-500/10 text-red-300 border-red-500/30",
  },
  RETRY_WAIT: {
    label: "Retry Otomatis",
    icon: RotateCcw,
    className:
      "bg-purple-500/10 text-purple-300 border-purple-500/30",
  },
};

const getCertificateStatus = (peserta) => {
  if (peserta?.certificateStatus) {
    return peserta.certificateStatus;
  }

  return peserta?.sertifikatTerkirim ? "COMPLETED" : "QUEUED";
};

const getCertificateStatusLabel = (peserta) => {
  const status = getCertificateStatus(peserta);

  return CERTIFICATE_STATUS[status]?.label || "Tidak Diketahui";
};

const formatFirestoreDate = (value) => {
  if (!value) return "-";

  try {
    const date = value?.toDate ? value.toDate() : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
};

const sanitizeFileName = (value = "rekap_peserta") => {
  return String(value)
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .substring(0, 100);
};

const CertificateStatusBadge = ({ peserta }) => {
  const status = getCertificateStatus(peserta);

  const config = CERTIFICATE_STATUS[status] || {
    label: "Tidak Diketahui",
    icon: AlertCircle,
    className:
      "bg-slate-500/10 text-slate-300 border-slate-500/30",
  };

  const Icon = config.icon;
  const isLoading = status === "PROCESSING" || status === "RETRY_WAIT";

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold whitespace-nowrap ${config.className}`}
    >
      <Icon className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
      {config.label}
    </span>
  );
};

const DashboardPage = ({ user }) => {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [kegiatanList, setKegiatanList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const [selectedKegiatanCsv, setSelectedKegiatanCsv] = useState(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  const [expandedKegiatanId, setExpandedKegiatanId] = useState(null);
  const [pesertaList, setPesertaList] = useState([]);
  const [loadingPeserta, setLoadingPeserta] = useState(false);

  const [retryingPesertaId, setRetryingPesertaId] = useState(null);

  // ID kegiatan yang sedang diproses menjadi file Excel.
  const [exportingKegiatanId, setExportingKegiatanId] = useState(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "kegiatan"),
      (snapshot) => {
        const data = snapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));

        setKegiatanList(data);
        setLoading(false);
      },
      (error) => {
        console.error("Gagal mengambil data kegiatan:", error);
        toast.error("Gagal mengambil data kegiatan.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!expandedKegiatanId) {
      setPesertaList([]);
      return;
    }

    setLoadingPeserta(true);

    const pesertaRef = collection(
      db,
      "kegiatan",
      expandedKegiatanId,
      "peserta"
    );

    const unsubscribePeserta = onSnapshot(
      pesertaRef,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        data.sort((a, b) => {
          const certA = String(a.nomorSertifikat || "");
          const certB = String(b.nomorSertifikat || "");

          return certA.localeCompare(certB, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        });

        setPesertaList(data);
        setLoadingPeserta(false);
      },
      (error) => {
        console.error("Gagal mengambil data peserta:", error);
        toast.error("Gagal mengambil data peserta.");
        setLoadingPeserta(false);
      }
    );

    return () => unsubscribePeserta();
  }, [expandedKegiatanId]);

  const filteredKegiatan = kegiatanList.filter((item) => {
    const nama = item.namaKegiatan || item.nama || "";
    const penyelenggara = item.penyelenggara || "";
    const queryText = searchQuery.toLowerCase();

    return (
      nama.toLowerCase().includes(queryText) ||
      penyelenggara.toLowerCase().includes(queryText)
    );
  });

  const handleLogout = async () => {
    if (!window.confirm("Apakah Anda yakin ingin keluar?")) {
      return;
    }

    try {
      await signOut(auth);
    } catch (error) {
      console.error("Gagal logout:", error);
      toast.error("Gagal keluar dari akun.");
    }
  };

  const handleToggleStatus = async (event, id, currentStatus) => {
    event.stopPropagation();

    setUpdatingId(id);

    const newStatus = !(currentStatus ?? true);

    try {
      const docRef = doc(db, "kegiatan", id);

      await updateDoc(docRef, {
        aktif: newStatus,
      });

      toast.success(
        newStatus
          ? "Kegiatan berhasil diaktifkan."
          : "Kegiatan berhasil dinonaktifkan."
      );
    } catch (error) {
      console.error("Gagal mengubah status kegiatan:", error);
      toast.error(`Gagal mengubah status: ${error.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const executeDelete = async (id, nama) => {
    const deleteProcess = async () => {
      const docRef = doc(db, "kegiatan", id);

      await deleteDoc(docRef);

      setKegiatanList((prev) =>
        prev.filter((item) => item.id !== id)
      );

      return `Kegiatan "${nama}" berhasil dihapus`;
    };

    toast.promise(deleteProcess(), {
      loading: "Menghapus kegiatan...",
      success: (message) => message,
      error: (error) =>
        `Gagal menghapus: ${error.message || String(error)}`,
    });
  };

  const handleDelete = (event, id, nama) => {
    event.stopPropagation();

    toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? "animate-enter" : "animate-leave"
          } max-w-md w-full bg-slate-800 border border-slate-700 shadow-xl rounded-2xl p-4 text-slate-100 flex flex-col gap-3 pointer-events-auto`}
        >
          <p className="text-xs text-slate-300">
            Apakah Anda yakin ingin menghapus kegiatan{" "}
            <span className="font-bold text-red-400">{nama}</span>?
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-700/60 hover:bg-slate-700 rounded-lg transition-all"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={() => {
                toast.dismiss(t.id);
                executeDelete(id, nama);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-all shadow-md shadow-red-600/20"
            >
              Hapus
            </button>
          </div>
        </div>
      ),
      {
        duration: 5000,
        position: "top-center",
      }
    );
  };

  const handleDeletePeserta = async (
    kegiatanId,
    pesertaId,
    namaPeserta
  ) => {
    const confirmed = window.confirm(
      `Hapus peserta "${namaPeserta || "Tanpa Nama"}" dari daftar?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const pesertaDocRef = doc(
        db,
        "kegiatan",
        kegiatanId,
        "peserta",
        pesertaId
      );

      await deleteDoc(pesertaDocRef);

      const kegiatanDocRef = doc(db, "kegiatan", kegiatanId);

      await updateDoc(kegiatanDocRef, {
        totalPeserta: increment(-1),
      });

      toast.success("Peserta berhasil dihapus.");
    } catch (error) {
      console.error("Gagal menghapus peserta:", error);
      toast.error(`Gagal menghapus peserta: ${error.message}`);
    }
  };

  const handleToggleExpand = (event, id) => {
    event.stopPropagation();

    setExpandedKegiatanId((prevId) =>
      prevId === id ? null : id
    );
  };

  const handleNavigateToForm = (item) => {
    const slugOrId = item.slug || item.id;
    navigate(`/kegiatan/${slugOrId}`);
  };

  const handleDownloadQR = (event, item) => {
    event.stopPropagation();

    const slugOrId = item.slug || item.id;
    const svgElement = document.getElementById(
      `qr-svg-${item.id}`
    );

    if (!svgElement) {
      toast.error("Elemen QR Code belum siap.");
      return;
    }

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const image = new Image();

    image.onload = () => {
      canvas.width = 1000;
      canvas.height = 1000;

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, 1000, 1000);

      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");

      downloadLink.download = `QR-${slugOrId}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    image.src =
      "data:image/svg+xml;base64," +
      btoa(unescape(encodeURIComponent(svgData)));
  };

  // ==========================================
  // EXPORT EXCEL REKAP PESERTA
  // ==========================================
  const handleExportExcel = async (event, kegiatan) => {
    event.stopPropagation();

    if (exportingKegiatanId) {
      return;
    }

    setExportingKegiatanId(kegiatan.id);

    const loadingToastId = toast.loading(
      "Menyiapkan file Excel rekap peserta..."
    );

    try {
      const pesertaRef = collection(
        db,
        "kegiatan",
        kegiatan.id,
        "peserta"
      );

      const pesertaSnapshot = await getDocs(pesertaRef);

      const pesertaData = pesertaSnapshot.docs
        .map((item) => ({
          id: item.id,
          ...item.data(),
        }))
        .sort((a, b) => {
          const certA = String(a.nomorSertifikat || "");
          const certB = String(b.nomorSertifikat || "");

          return certA.localeCompare(certB, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        });

      if (pesertaData.length === 0) {
        toast.dismiss(loadingToastId);
        toast.error("Belum ada peserta untuk diexport.");
        return;
      }

      const namaKegiatan =
        kegiatan.namaKegiatan || kegiatan.nama || "Kegiatan";

      const rows = pesertaData.map((peserta, index) => ({
        No: index + 1,
        "Nomor Sertifikat": peserta.nomorSertifikat || "-",
        "Nama Lengkap": peserta.nama || "-",
        Email: peserta.email || "-",
        "Instansi / Lembaga": peserta.instansi || "-",
        "Instansi Manual": peserta.instansiManual ? "Ya" : "Tidak",
        "Jabatan / Peran": peserta.jabatan || "-",
        "Status Sertifikat": getCertificateStatusLabel(peserta),
        "Status Kode": getCertificateStatus(peserta),
        "Sertifikat Terkirim": peserta.sertifikatTerkirim ? "Ya" : "Belum",
        "Waktu Presensi": formatFirestoreDate(
          peserta.waktuPresensi
        ),
        "Waktu Diproses": formatFirestoreDate(
          peserta.certificateProcessedAt
        ),
        "Jumlah Percobaan Kirim": peserta.certificateAttempts || 0,
        "Pesan Error": peserta.certificateError || "-",
        "URL Arsip Google Drive":
          peserta.certificateDriveUrl || "-",
      }));

      const totalPeserta = pesertaData.length;

      const totalCompleted = pesertaData.filter(
        (peserta) => getCertificateStatus(peserta) === "COMPLETED"
      ).length;

      const totalFailed = pesertaData.filter(
        (peserta) => getCertificateStatus(peserta) === "FAILED"
      ).length;

      const totalQueued = pesertaData.filter(
        (peserta) => getCertificateStatus(peserta) === "QUEUED"
      ).length;

      const totalProcessing = pesertaData.filter(
        (peserta) => getCertificateStatus(peserta) === "PROCESSING"
      ).length;

      const totalRetryWait = pesertaData.filter(
        (peserta) => getCertificateStatus(peserta) === "RETRY_WAIT"
      ).length;

      const ringkasanRows = [
        {
          Keterangan: "Nama Kegiatan",
          Nilai: namaKegiatan,
        },
        {
          Keterangan: "Penyelenggara",
          Nilai:
            kegiatan.penyelenggara || "KPU Kabupaten Sekadau",
        },
        {
          Keterangan: "Kode Undangan",
          Nilai: kegiatan.kodeUndangan || "-",
        },
        {
          Keterangan: "Tanggal Export",
          Nilai: new Date().toLocaleString("id-ID"),
        },
        {
          Keterangan: "Total Peserta",
          Nilai: totalPeserta,
        },
        {
          Keterangan: "Sertifikat Terkirim",
          Nilai: totalCompleted,
        },
        {
          Keterangan: "Menunggu Antrean",
          Nilai: totalQueued,
        },
        {
          Keterangan: "Sedang Diproses",
          Nilai: totalProcessing,
        },
        {
          Keterangan: "Menunggu Retry Otomatis",
          Nilai: totalRetryWait,
        },
        {
          Keterangan: "Gagal Dikirim",
          Nilai: totalFailed,
        },
      ];

      const workbook = XLSX.utils.book_new();

      const pesertaWorksheet = XLSX.utils.json_to_sheet(rows);
      const ringkasanWorksheet = XLSX.utils.json_to_sheet(
        ringkasanRows
      );

      pesertaWorksheet["!cols"] = [
        { wch: 6 },
        { wch: 27 },
        { wch: 30 },
        { wch: 32 },
        { wch: 30 },
        { wch: 16 },
        { wch: 24 },
        { wch: 20 },
        { wch: 16 },
        { wch: 20 },
        { wch: 21 },
        { wch: 21 },
        { wch: 22 },
        { wch: 55 },
        { wch: 55 },
      ];

      ringkasanWorksheet["!cols"] = [
        { wch: 30 },
        { wch: 45 },
      ];

      XLSX.utils.book_append_sheet(
        workbook,
        pesertaWorksheet,
        "Rekap Peserta"
      );

      XLSX.utils.book_append_sheet(
        workbook,
        ringkasanWorksheet,
        "Ringkasan"
      );

      const safeNamaKegiatan = sanitizeFileName(namaKegiatan);

      const tanggalExport = new Date()
        .toLocaleDateString("id-ID")
        .replace(/\//g, "-");

      const fileName =
        `Rekap_Peserta_${safeNamaKegiatan}_${tanggalExport}.xlsx`;

      XLSX.writeFile(workbook, fileName, {
        compression: true,
      });

      toast.dismiss(loadingToastId);

      toast.success(
        `${totalPeserta} data peserta berhasil diexport ke Excel.`
      );
    } catch (error) {
      console.error("Gagal export Excel:", error);

      toast.dismiss(loadingToastId);

      toast.error(
        error.message || "Gagal membuat file Excel."
      );
    } finally {
      setExportingKegiatanId(null);
    }
  };

  // ==========================================
  // KIRIM ULANG SERTIFIKAT GAGAL
  // ==========================================
  const handleRetryCertificate = async (
    event,
    kegiatanId,
    peserta
  ) => {
    event.stopPropagation();

    if (retryingPesertaId) {
      return;
    }

    const confirmed = window.confirm(
      `Kirim ulang sertifikat?\n\n` +
        `Nama: ${peserta.nama || "-"}\n` +
        `Email: ${peserta.email || "-"}\n` +
        `Nomor: ${peserta.nomorSertifikat || "-"}\n\n` +
        `Pastikan alamat email sudah benar sebelum melanjutkan.`
    );

    if (!confirmed) {
      return;
    }

    setRetryingPesertaId(peserta.id);

    try {
      const response = await fetch(
        `${BACKEND_API_URL}/api/retry-certificate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kegiatanId,
            pesertaId: peserta.id,
          }),
        }
      );

      let result = null;

      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message ||
            "Gagal memasukkan peserta ke antrean sertifikat."
        );
      }

      toast.success(
        `Sertifikat ${
          peserta.nama || "peserta"
        } dimasukkan kembali ke antrean.`
      );
    } catch (error) {
      console.error("Gagal kirim ulang sertifikat:", error);

      toast.error(
        error.message ||
          "Gagal memasukkan peserta ke antrean ulang."
      );
    } finally {
      setRetryingPesertaId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col mx-auto shadow-2xl border-x border-slate-800 relative">
      <header className="bg-slate-800/80 backdrop-blur-md p-4 sticky top-0 z-20 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
            <ShieldCheck className="w-6 h-6" />
          </div>

          <div>
            <h1 className="text-base font-bold leading-tight">
              E-Sertifikat
            </h1>

            <p className="text-xs text-slate-400 truncate max-w-[180px]">
              {user?.email || "Admin KPU Sekadau"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-all cursor-pointer"
          title="Keluar"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 p-4 pb-24 space-y-4">
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />

            <input
              type="text"
              placeholder="Cari nama kegiatan..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>

          <button
            type="button"
            onClick={() => navigate("/admin/kegiatan/buat")}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-2xl flex items-center justify-between shadow-lg shadow-blue-600/20 cursor-pointer hover:opacity-95 transition-all active:scale-[0.98] text-left"
          >
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-blue-200 tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Buat Acara Baru
              </span>

              <h3 className="text-sm font-bold text-white">
                Tambah Kegiatan & Template
              </h3>
            </div>

            <div className="w-9 h-9 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-white">
              <Plus className="w-5 h-5" />
            </div>
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between pt-2">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
              Daftar Kegiatan ({filteredKegiatan.length})
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-sm">Memuat data kegiatan...</span>
            </div>
          ) : filteredKegiatan.length === 0 ? (
            <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
              <p className="text-slate-400 text-sm">
                Tidak ada kegiatan ditemukan.
              </p>
            </div>
          ) : (
            filteredKegiatan.map((item) => {
              const nama =
                item.namaKegiatan || item.nama || "Tanpa Judul";

              const isAktif = item.aktif ?? true;
              const slugOrId = item.slug || item.id;

              const publicFormUrl =
                `${window.location.origin}/kegiatan/${slugOrId}`;

              const tanggal = item.createdAt?.toDate?.()
                ? item.createdAt.toDate().toLocaleDateString("id-ID")
                : item.tanggal || "Terbaru";

              const isExpanded = expandedKegiatanId === item.id;
              const isExporting =
                exportingKegiatanId === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => handleNavigateToForm(item)}
                  className={`bg-slate-800/60 border ${
                    isAktif
                      ? "border-slate-700/60 hover:border-blue-500/50"
                      : "border-red-900/30 opacity-75"
                  } rounded-2xl p-4 space-y-3 transition-all cursor-pointer group relative`}
                >
                  <div className="hidden">
                    <QRCodeSVG
                      id={`qr-svg-${item.id}`}
                      value={publicFormUrl}
                      size={500}
                      bgColor="#FFFFFF"
                      fgColor="#000000"
                      level="H"
                      imageSettings={{
                        src: KPU_LOGO_URL,
                        x: undefined,
                        y: undefined,
                        height: 100,
                        width: 100,
                        excavate: true,
                      }}
                    />
                  </div>

                  {item.bannerUrl && (
                    <img
                      src={item.bannerUrl}
                      alt={nama}
                      className="w-full h-24 object-cover rounded-xl border border-slate-700/50 mb-2"
                    />
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div className="pr-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {tanggal}
                        </span>

                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            isAktif
                              ? "bg-green-500/10 text-green-400 border border-green-500/20"
                              : "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}
                        >
                          {isAktif ? "Aktif" : "Nonaktif"}
                        </span>
                      </div>

                      <h3 className="text-base font-semibold text-white mt-1 group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                        <span className="truncate">{nama}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400 shrink-0" />
                      </h3>

                      <p className="text-xs text-slate-400">
                        {item.penyelenggara || "KPU Kabupaten Sekadau"}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      <button
                        type="button"
                        onClick={(event) =>
                          handleDownloadQR(event, item)
                        }
                        className="p-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-lg transition-colors"
                        title="Unduh QR Code Form"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>

                      {/* EXPORT EXCEL */}
                      <button
                        type="button"
                        onClick={(event) =>
                          handleExportExcel(event, item)
                        }
                        disabled={Boolean(exportingKegiatanId)}
                        className="p-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Export Rekap Peserta ke Excel"
                      >
                        {isExporting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedKegiatanCsv(item);
                          setIsCsvModalOpen(true);
                        }}
                        className="p-1.5 bg-green-600/10 hover:bg-green-600/20 text-green-400 border border-green-500/20 rounded-lg transition-colors"
                        title="Import CSV Peserta"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(event) =>
                          handleToggleStatus(
                            event,
                            item.id,
                            isAktif
                          )
                        }
                        disabled={updatingId === item.id}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                          isAktif ? "bg-green-600" : "bg-slate-700"
                        }`}
                        title={
                          isAktif
                            ? "Klik untuk Nonaktifkan"
                            : "Klik untuk Aktifkan"
                        }
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isAktif
                              ? "translate-x-5"
                              : "translate-x-0"
                          }`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={(event) =>
                          handleDelete(event, item.id, nama)
                        }
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                        title="Hapus Kegiatan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-xl text-xs gap-2">
                    <span className="text-slate-400 text-[11px]">
                      Total Peserta:{" "}
                      <span className="font-bold text-slate-200">
                        {item.totalPeserta || 0}
                      </span>
                    </span>

                    <button
                      type="button"
                      onClick={(event) =>
                        handleToggleExpand(event, item.id)
                      }
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 flex items-center gap-1 text-[11px] transition-all"
                    >
                      <span>
                        {isExpanded ? "Tutup Daftar" : "Daftar Absen"}
                      </span>

                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {isExpanded && (
                    <div
                      onClick={(event) => event.stopPropagation()}
                      className="pt-2 border-t border-slate-700/60 space-y-2 cursor-default"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                          <UserCheck className="w-4 h-4 text-blue-400" />
                          Peserta Terdaftar
                        </span>

                        <span>Total: {pesertaList.length}</span>
                      </div>

                      {loadingPeserta ? (
                        <div className="flex items-center justify-center py-4 text-slate-400 gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                          <span className="text-xs">
                            Memuat daftar peserta...
                          </span>
                        </div>
                      ) : pesertaList.length === 0 ? (
                        <p className="text-center py-3 text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
                          Belum ada peserta yang mengisi absen.
                        </p>
                      ) : (
                        <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                          {pesertaList.map((peserta, index) => {
                            const status =
                              getCertificateStatus(peserta);

                            const isFailed = status === "FAILED";
                            const isRetrying =
                              retryingPesertaId === peserta.id;

                            return (
                              <div
                                key={peserta.id || index}
                                className={`p-2.5 rounded-xl border text-xs ${
                                  isFailed
                                    ? "bg-red-500/5 border-red-500/30"
                                    : "bg-slate-900/80 border-slate-800"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start gap-2">
                                      <span className="text-[10px] text-slate-400 shrink-0 pt-0.5">
                                        {index + 1}.
                                      </span>

                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <p className="font-medium text-slate-200 break-words">
                                            {peserta.nama || "Tanpa Nama"}
                                          </p>

                                          <CertificateStatusBadge
                                            peserta={peserta}
                                          />
                                        </div>

                                        <p className="text-[10px] text-slate-400 break-all mt-0.5">
                                          <Mail className="w-3 h-3 inline mr-1 text-slate-500" />
                                          {peserta.email || "-"}
                                        </p>

                                        <p className="text-[10px] text-slate-500 mt-0.5">
                                          {peserta.instansi || "-"}
                                          {peserta.jabatan
                                            ? ` • ${peserta.jabatan}`
                                            : ""}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-[9px] text-indigo-300 bg-indigo-500/10 px-1.5 py-1 rounded border border-indigo-500/20 max-w-[115px] truncate">
                                      {peserta.nomorSertifikat ||
                                        "Terdaftar"}
                                    </span>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeletePeserta(
                                          item.id,
                                          peserta.id,
                                          peserta.nama
                                        )
                                      }
                                      disabled={Boolean(
                                        retryingPesertaId
                                      )}
                                      className="p-1 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-400 rounded transition-colors"
                                      title="Hapus Peserta"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {isFailed && (
                                  <div className="mt-2 pt-2 border-t border-red-500/20 space-y-2">
                                    <div className="flex items-start gap-1.5">
                                      <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />

                                      <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-red-300">
                                          Penyebab gagal:
                                        </p>

                                        <p className="text-[10px] text-red-200/80 break-words mt-0.5">
                                          {peserta.certificateError ||
                                            "Penyebab error belum tersedia. Periksa failed_certificates.log pada server."}
                                        </p>
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={(event) =>
                                        handleRetryCertificate(
                                          event,
                                          item.id,
                                          peserta
                                        )
                                      }
                                      disabled={Boolean(
                                        retryingPesertaId
                                      )}
                                      className="w-full px-2.5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center gap-1.5 text-[10px] font-bold transition-colors"
                                    >
                                      {isRetrying ? (
                                        <>
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          Memasukkan Antrean...
                                        </>
                                      ) : (
                                        <>
                                          <RefreshCw className="w-3.5 h-3.5" />
                                          Kirim Ulang Sertifikat
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}

                                {status === "RETRY_WAIT" && (
                                  <div className="mt-2 pt-2 border-t border-purple-500/20">
                                    <p className="text-[10px] text-purple-200">
                                      Sistem menunggu jadwal pengiriman ulang
                                      otomatis.
                                    </p>
                                  </div>
                                )}

                                {status === "COMPLETED" &&
                                  peserta.certificateDriveUrl && (
                                    <a
                                      href={peserta.certificateDriveUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-2 w-full px-2.5 py-2 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 border border-emerald-500/20 rounded-lg flex items-center justify-center gap-1.5 text-[10px] font-bold transition-colors"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      Buka Arsip Drive
                                    </a>
                                  )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      <button
        type="button"
        onClick={() => navigate("/admin/kegiatan/buat")}
        className="fixed bottom-6 right-4 w-14 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-2xl shadow-blue-600/50 flex items-center justify-center transition-all cursor-pointer border border-blue-400/30 active:scale-95 z-30"
        title="Buat Kegiatan Baru"
      >
        <Plus className="w-7 h-7" />
      </button>

      <ImportCsvModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        kegiatan={selectedKegiatanCsv}
      />
    </div>
  );
};

export default DashboardPage;