import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import {
  Plus,
  Search,
  ShieldCheck,
  LogOut,
  Calendar,
  Users,
  Sparkles,
  Trash2,
  ExternalLink,
  Loader2,
  QrCode,
  ChevronDown,
  ChevronUp,
  UserCheck,
  FileSpreadsheet,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import {
  collection,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { db, auth } from "../../utils/Firebase";
import { toast } from "sonner";
import ImportCsvModal from "./ImportCsvModal";

const KPU_LOGO_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/KPU_Logo.svg/1920px-KPU_Logo.svg.png";

const DashboardPage = ({ user }) => {
  const navigate = useNavigate();

  // State Utama
  const [searchQuery, setSearchQuery] = useState("");
  const [kegiatanList, setKegiatanList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedKegiatanCsv, setSelectedKegiatanCsv] = useState(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  // State Expand Peserta per Kegiatan
  const [expandedKegiatanId, setExpandedKegiatanId] = useState(null);
  const [pesertaList, setPesertaList] = useState([]);
  const [loadingPeserta, setLoadingPeserta] = useState(false);

  // Fetch Data Kegiatan dari Firestore secara Realtime
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
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  // Fetch Daftar Peserta yang Sudah Absen ketika Card Di-Expand
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
      "peserta",
    );

    const unsubscribePeserta = onSnapshot(
      pesertaRef,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // URUTKAN BERDASARKAN NOMOR SERTIFIKAT
        data.sort((a, b) => {
          const certA = (a.nomorSertifikat || "").toString();
          const certB = (b.nomorSertifikat || "").toString();
          return certA.localeCompare(certB, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        });

        setPesertaList(data);
        setLoadingPeserta(false);
      },
      (err) => {
        console.error("Gagal mengambil data peserta:", err);
        setLoadingPeserta(false);
      },
    );

    return () => unsubscribePeserta();
  }, [expandedKegiatanId]);

  // Filter Kegiatan
  const filteredKegiatan = kegiatanList.filter((item) => {
    const nama = item.namaKegiatan || item.nama || "";
    const penyelenggara = item.penyelenggara || "";
    const query = searchQuery.toLowerCase();
    return (
      nama.toLowerCase().includes(query) ||
      penyelenggara.toLowerCase().includes(query)
    );
  });

  // Handle Logout
  const handleLogout = async () => {
    if (window.confirm("Apakah Anda yakin ingin keluar?")) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Gagal logout:", error);
      }
    }
  };

  // Toggle Status Aktif (true / false)
  const handleToggleStatus = async (e, id, currentStatus) => {
    e.stopPropagation();
    setUpdatingId(id);

    const newStatus = !(currentStatus ?? true);

    try {
      const docRef = doc(db, "kegiatan", id);
      await updateDoc(docRef, { aktif: newStatus });
    } catch (error) {
      console.error("Gagal mengubah status kegiatan:", error);
      toast.error("Gagal mengubah status: " + error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Eksekusi Hapus Kegiatan
  const executeDelete = async (id, nama) => {
    const deleteProcess = async () => {
      const docRef = doc(db, "kegiatan", id);
      await deleteDoc(docRef);
      setKegiatanList((prev) => prev.filter((item) => item.id !== id));
      return `Kegiatan "${nama}" berhasil dihapus`;
    };

    toast.promise(deleteProcess(), {
      loading: "Menghapus kegiatan...",
      success: (msg) => msg,
      error: (err) => `Gagal menghapus: ${err.message || err}`,
    });
  };

  // Handler Hapus Kegiatan
  const handleDelete = (e, id, nama) => {
    e.stopPropagation();

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
      { duration: 5000, position: "top-center" },
    );
  };

  // Handler Hapus Peserta Terdaftar
  const handleDeletePeserta = async (kegiatanId, pesertaId, namaPeserta) => {
    if (!window.confirm(`Hapus peserta "${namaPeserta || 'Tanpa Nama'}" dari daftar?`)) return;

    try {
      // 1. Hapus dokumen peserta di sub-koleksi
      const pesertaDocRef = doc(db, "kegiatan", kegiatanId, "peserta", pesertaId);
      await deleteDoc(pesertaDocRef);

      // 2. Kurangi counter totalPeserta di dokumen kegiatan utama
      const kegiatanDocRef = doc(db, "kegiatan", kegiatanId);
      await updateDoc(kegiatanDocRef, {
        totalPeserta: increment(-1)
      });

      toast.success("Peserta berhasil dihapus");
    } catch (error) {
      console.error("Gagal menghapus peserta:", error);
      toast.error("Gagal menghapus peserta: " + error.message);
    }
  };

  // Toggle Expand Accordion Peserta
  const handleToggleExpand = (e, id) => {
    e.stopPropagation();
    setExpandedKegiatanId((prevId) => (prevId === id ? null : id));
  };

  // Navigasi ke Form URL Publik Peserta
  const handleNavigateToForm = (item) => {
    const slugOrId = item.slug || item.id;
    navigate(`/kegiatan/${slugOrId}`);
  };

  // Unduh QR Code
  const handleDownloadQR = (e, item) => {
    e.stopPropagation();

    const slugOrId = item.slug || item.id;
    const svgElement = document.getElementById(`qr-svg-${item.id}`);
    if (!svgElement) return alert("Elemen QR Code belum siap.");

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
      downloadLink.download = `QR-${slugOrId}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src =
      "data:image/svg+xml;base64," +
      btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col mx-auto shadow-2xl border-x border-slate-800 relative">
      {/* 1. TOP HEADER */}
      <header className="bg-slate-800/80 backdrop-blur-md p-4 sticky top-0 z-20 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">E-Sertifikat</h1>
            <p className="text-xs text-slate-400 truncate max-w-[180px]">
              {user?.email || "Admin KPU Sekadau"}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-all cursor-pointer"
          title="Keluar"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* 2. MAIN CONTENT AREA */}
      <main className="flex-1 p-4 pb-24 space-y-4">
        {/* ACTION & SEARCH BAR */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Cari nama kegiatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>

          <div
            onClick={() => navigate("/admin/kegiatan/buat")}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-2xl flex items-center justify-between shadow-lg shadow-blue-600/20 cursor-pointer hover:opacity-95 transition-all active:scale-[0.98]"
          >
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-blue-200 tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Buat Acara Baru
              </span>
              <h3 className="text-sm font-bold text-white">
                Tambah Kegiatan & Template
              </h3>
            </div>
            <div className="w-9 h-9 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-white">
              <Plus className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* LIST KEGIATAN */}
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
              const nama = item.namaKegiatan || item.nama || "Tanpa Judul";
              const isAktif = item.aktif ?? true;
              const slugOrId = item.slug || item.id;
              const publicFormUrl = `${window.location.origin}/kegiatan/${slugOrId}`;
              const tanggal = item.createdAt?.toDate?.()
                ? item.createdAt.toDate().toLocaleDateString("id-ID")
                : item.tanggal || "Terbaru";

              const isExpanded = expandedKegiatanId === item.id;

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
                  {/* Hidden SVG QR Code */}
                  <div className="hidden mr-2">
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

                  {/* Banner Image Preview */}
                  {item.bannerUrl && (
                    <img
                      src={item.bannerUrl}
                      alt={nama}
                      className="w-full h-24 object-cover rounded-xl border border-slate-700/50 mb-2"
                    />
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div className="pr-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {tanggal}
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
                        {nama}
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400" />
                      </h3>
                      <p className="text-xs text-slate-400">
                        {item.penyelenggara || "KPU Kabupaten Sekadau"}
                      </p>
                    </div>

                    {/* Action Group */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleDownloadQR(e, item)}
                        className="p-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-lg transition-colors"
                        title="Unduh QR Code Form"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
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
                        onClick={(e) => handleToggleStatus(e, item.id, isAktif)}
                        disabled={updatingId === item.id}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isAktif ? "bg-green-600" : "bg-slate-700"
                        }`}
                        title={
                          isAktif
                            ? "Klik untuk Nonaktifkan"
                            : "Klik untuk Aktifkan"
                        }
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                            isAktif ? "translate-x-5" : "translate-x-0"
                          }`}
                        ></span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, item.id, nama)}
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                        title="Hapus Kegiatan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Info Ringkas Stats & Tombol Expand (Total Peserta di Kiri Tombol Daftar Absen) */}
                  <div className="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-xl text-xs gap-2">
                    

                    <button
                      type="button"
                      onClick={(e) => handleToggleExpand(e, item.id)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 w-full text-slate-300 rounded-lg border border-slate-700 flex items-center gap-1 text-[11px] transition-all"
                    >
                      <span>{isExpanded ? "Tutup" : "Daftar Absen"}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* EXPANDABLE SECTION: DAFTAR PESERTA ABSEN */}
                  {isExpanded && (
                    <div
                      onClick={(e) => e.stopPropagation()}
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
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                          {pesertaList.map((p, idx) => (
                            <div
                              key={p.id || idx}
                              className="p-2 bg-slate-900/80 rounded-lg border border-slate-800 flex items-center justify-between text-xs"
                            >
                              <div className="truncate pr-2 flex-1">
                                <div className="flex items-center gap-2 truncate">
                                  <span className="text-[10px] text-slate-400 shrink-0">
                                    {idx + 1}
                                  </span>
                                  <div className="flex flex-col truncate">
                                    <p className="font-medium text-slate-200 truncate">
                                      {p.nama || "Tanpa Nama"}
                                    </p>
                                    <p className="text-[10px] text-slate-400 truncate">
                                      {p.email || "-"}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                  {p.nomorSertifikat || "Terdaftar"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePeserta(item.id, p.id, p.nama)}
                                  className="p-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                                  title="Hapus Peserta"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
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

      {/* FLOATING ACTION BUTTON (FAB) FOR CREATE */}
      <button
        onClick={() => navigate("/admin/kegiatan/buat")}
        className="sticky bottom-6 left-full mr-4 w-14 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-2xl shadow-blue-600/50 flex items-center justify-center transition-all cursor-pointer border border-blue-400/30 active:scale-95 z-30"
        title="Buat Kegiatan Baru"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Modal Import CSV */}
      <ImportCsvModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        kegiatan={selectedKegiatanCsv}
      />
    </div>
  );
};

export default DashboardPage;