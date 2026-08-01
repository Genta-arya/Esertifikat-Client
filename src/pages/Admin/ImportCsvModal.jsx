import React, { useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  Download,
  X,
  Loader2,
  Send,
  CheckCircle2,
  Minimize2,
  Maximize2,
  Timer,
} from "lucide-react";
import Papa from "papaparse";
import template from "../../assets/template_import.csv?url";
import { toast } from "sonner";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "../../utils/Firebase";

// const BACKEND_IMPORT_SINGLE_URL =
//   "http://localhost:3080/api/process-import-single";
const BACKEND_IMPORT_SINGLE_URL = "https://esertifikat.apiservices.my.id/api/process-import-single";

const ImportCsvModal = ({ isOpen, onClose, kegiatan }) => {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);

  // State untuk Progress Widget Melayang + Countdown
  const [progressState, setProgressState] = useState({
    active: false,
    minimized: false,
    total: 0,
    current: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    currentNama: "",
    countdown: 0,
    statusText: "Memulai antrean...",
  });

  if (!isOpen && !progressState.active) return null;

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(template);
      const csvData = await response.text();
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `Template_Import_Peserta_${kegiatan?.namaKegiatan || "KPU"}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Gagal mengunduh template CSV.");
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      toast.error("Format file harus ber-ekstensi .csv");
      return;
    }

    setFile(selectedFile);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";",
      complete: (results) => {
        const cleanedData = results.data
          .map((row) => ({
            nama: (
              row.nama ||
              row.Nama ||
              row.NAMA ||
              row["Nama Lengkap"] ||
              ""
            ).trim(),
            email: (row.email || row.Email || row.EMAIL || "").trim(),
            nomorSertifikat: (
              row.no_sertifikat ||
              row.nomorSertifikat ||
              row.noSertifikat ||
              row.no ||
              ""
            ).trim(),
          }))
          .filter((item) => item.nama !== "" && item.nomorSertifikat !== "");

        setParsedData(cleanedData);

        if (cleanedData.length === 0) {
          toast.warning(
            "Tidak ada baris valid yang memiliki Nama dan No Sertifikat.",
          );
        } else {
          toast.success(
            `Berhasil membaca ${cleanedData.length} data peserta dari CSV!`,
          );
        }
      },
      error: (err) => {
        toast.error("Gagal membaca file CSV: " + err.message);
      },
    });
  };

  // =========================================================================
  // PROSES IMPORT DENGAN OPTIMASI FIREBASE READ & SAFE DELAY
  // =========================================================================
  const handleProcessImport = async () => {
    if (parsedData.length === 0 || !kegiatan?.templateUrl || !kegiatan?.id) {
      toast.error("Data peserta, ID kegiatan, atau template belum lengkap.");
      return;
    }

    const total = parsedData.length;
    const dataToProcess = [...parsedData];

    setFile(null);
    setParsedData([]);
    onClose();

    setProgressState({
      active: true,
      minimized: false,
      total,
      current: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      currentNama: "Menyiapkan data...",
      countdown: 0,
      statusText: "Memeriksa database...",
    });

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "Proses pembuatan sertifikat sedang berjalan. Yakin ingin keluar?";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;
    const currentYear = new Date().getFullYear();
    const targetDocId = kegiatan.id;
    const pesertaRef = collection(db, "kegiatan", targetDocId, "peserta");

    // 1. OPTIMASI FIREBASE: Ambil semua email peserta sekaligus di awal (1x Read)
    const existingEmails = new Set();
    try {
      const existingSnapshot = await getDocs(pesertaRef);
      existingSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.email) existingEmails.add(data.email.toLowerCase());
      });
    } catch (err) {
      console.error("Gagal memuat daftar email eksisting:", err);
    }

    for (let i = 0; i < total; i++) {
      const peserta = dataToProcess[i];
      const cleanEmail = peserta.email ? peserta.email.toLowerCase() : "";

      setProgressState((prev) => ({
        ...prev,
        current: i + 1,
        currentNama: peserta.nama,
        statusText: "Memeriksa duplikasi email...",
        countdown: 0,
      }));

      try {
        // 2. CEK INSTAN DI MEMORI (Tanpa query ke Firebase di dalam loop)
        if (cleanEmail && existingEmails.has(cleanEmail)) {
          skipCount++;
          console.log(`[Skipped] Email ${cleanEmail} sudah ada di database.`);
          setProgressState((prev) => ({ ...prev, skipped: skipCount }));
          continue;
        }

        setProgressState((prev) => ({
          ...prev,
          statusText: "Mengirim PDF & Email ke Server...",
        }));

        // 3. HIT BACKEND
        const res = await fetch(BACKEND_IMPORT_SINGLE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nama: peserta.nama,
            nomorSertifikat: peserta.nomorSertifikat,
            templateUrl: kegiatan.templateUrl,
            emailPeserta: peserta.email,
            namaKegiatan: kegiatan.namaKegiatan || "",
          }),
        });

        if (!res.ok) {
          // Aman dari crash jika server membalas error non-JSON (HTML 502/504)
          const errData = await res.json().catch(() => ({ error: `HTTP Error ${res.status}` }));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        // 4. SIMPAN KE FIREBASE & TAMBAHKAN KE MEMORY SET
        if (cleanEmail) existingEmails.add(cleanEmail);

        const counterDocRef = doc(db, "counters", `sertifikat_${currentYear}`);
        const newPesertaDocRef = doc(pesertaRef);
        const kegiatanRef = doc(db, "kegiatan", targetDocId);

        await runTransaction(db, async (transaction) => {
          const counterSnap = await transaction.get(counterDocRef);
          const kegiatanSnap = await transaction.get(kegiatanRef);

          let currentLast = counterSnap.exists() ? counterSnap.data().lastNumber || 0 : 0;
          const currentTotal = kegiatanSnap.data()?.totalPeserta || 0;

          transaction.set(
            counterDocRef,
            {
              lastNumber: currentLast,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          transaction.set(newPesertaDocRef, {
            nama: peserta.nama,
            email: cleanEmail,
            instansi: peserta.instansi || "-",
            jabatan: peserta.jabatan || "-",
            nomorSertifikat: peserta.nomorSertifikat,
            sertifikatTerkirim: true,
            waktuPresensi: serverTimestamp(),
          });

          transaction.update(kegiatanRef, {
            totalPeserta: currentTotal + 1,
          });
        });

        successCount++;
      } catch (err) {
        failCount++;
        console.error(`Gagal untuk ${peserta.nama}:`, err.message);
      }

      setProgressState((prev) => ({
        ...prev,
        success: successCount,
        failed: failCount,
        skipped: skipCount,
      }));

      // 5. JEDA 2 DETIK (Sinkron dengan SMTP Pool & p-queue Backend)
      if (i < total - 1) {
        for (let sec = 2; sec >= 1; sec--) {
          setProgressState((prev) => ({
            ...prev,
            statusText: "Menunggu antrean berikutnya...",
            countdown: sec,
          }));
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        setProgressState((prev) => ({ ...prev, countdown: 0 }));
      }
    }

    setProgressState((prev) => ({
      ...prev,
      statusText: "Selesai!",
      currentNama: "Semua antrean import beres.",
      countdown: 0,
    }));

    window.removeEventListener("beforeunload", handleBeforeUnload);
    toast.success(
      `Selesai! Berhasil: ${successCount}, Dilewati (Sudah Ada): ${skipCount}, Gagal: ${failCount}`,
      { duration: 8000 }
    );
  };
  // const handleProcessImport = async () => {
  //   if (parsedData.length === 0 || !kegiatan?.templateUrl || !kegiatan?.id) {
  //     toast.error("Data peserta, ID kegiatan, atau template belum lengkap.");
  //     return;
  //   }

  //   const total = parsedData.length;
  //   const dataToProcess = [...parsedData];

  //   setFile(null);
  //   setParsedData([]);
  //   onClose();

  //   setProgressState({
  //     active: true,
  //     minimized: false,
  //     total,
  //     current: 0,
  //     success: 0,
  //     failed: 0,
  //     skipped: 0,
  //     currentNama: "Menyiapkan data...",
  //     countdown: 0,
  //     statusText: "Memeriksa database...",
  //   });

  //   const handleBeforeUnload = (e) => {
  //     e.preventDefault();
  //     e.returnValue =
  //       "Proses pembuatan sertifikat sedang berjalan. Yakin ingin keluar?";
  //   };
  //   window.addEventListener("beforeunload", handleBeforeUnload);

  //   let successCount = 0;
  //   let failCount = 0;
  //   let skipCount = 0;
  //   const currentYear = new Date().getFullYear();
  //   const targetDocId = kegiatan.id;
  //   const pesertaRef = collection(db, "kegiatan", targetDocId, "peserta");

  //   // =========================================================================
  //   // [TEST MODE] Pengecekan email eksisting dinonaktifkan sementara
  //   // =========================================================================
  //   // const existingEmails = new Set();
  //   // try {
  //   //   const existingSnapshot = await getDocs(pesertaRef);
  //   //   existingSnapshot.forEach((docSnap) => {
  //   //     const data = docSnap.data();
  //   //     if (data.email) existingEmails.add(data.email.toLowerCase());
  //   //   });
  //   // } catch (err) {
  //   //   console.error("Gagal memuat daftar email eksisting:", err);
  //   // }

  //   for (let i = 0; i < total; i++) {
  //     const peserta = dataToProcess[i];
  //     const cleanEmail = peserta.email ? peserta.email.toLowerCase() : "";

  //     setProgressState((prev) => ({
  //       ...prev,
  //       current: i + 1,
  //       currentNama: peserta.nama,
  //       statusText: "Menyiapkan pengiriman...",
  //       countdown: 0,
  //     }));

  //     try {
  //       // =====================================================================
  //       // [TEST MODE] Blok pengecekan skip email duplikat dimatikan:
  //       // =====================================================================
  //       // if (cleanEmail && existingEmails.has(cleanEmail)) {
  //       //   skipCount++;
  //       //   console.log(`[Skipped] Email ${cleanEmail} sudah ada di database.`);
  //       //   setProgressState((prev) => ({ ...prev, skipped: skipCount }));
  //       //   continue;
  //       // }

  //       setProgressState((prev) => ({
  //         ...prev,
  //         statusText: "Mengirim PDF & Email ke Server...",
  //       }));

  //       // 1. HIT BACKEND
  //       const res = await fetch(BACKEND_IMPORT_SINGLE_URL, {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify({
  //           nama: peserta.nama,
  //           nomorSertifikat: peserta.nomorSertifikat,
  //           templateUrl: kegiatan.templateUrl,
  //           emailPeserta: peserta.email,
  //           namaKegiatan: kegiatan.namaKegiatan || "",
  //         }),
  //       });

  //       if (!res.ok) {
  //         // Aman dari crash jika server membalas error non-JSON (HTML 502/504)
  //         const errData = await res
  //           .json()
  //           .catch(() => ({ error: `HTTP Error ${res.status}` }));
  //         throw new Error(errData.error || `HTTP ${res.status}`);
  //       }

  //       // 2. SIMPAN KE FIREBASE (tetap masuk ke Firestore sebagai dokumen baru)
  //       // if (cleanEmail) existingEmails.add(cleanEmail);

  //       const counterDocRef = doc(db, "counters", `sertifikat_${currentYear}`);
  //       const newPesertaDocRef = doc(pesertaRef);
  //       const kegiatanRef = doc(db, "kegiatan", targetDocId);

  //       await runTransaction(db, async (transaction) => {
  //         const counterSnap = await transaction.get(counterDocRef);
  //         const kegiatanSnap = await transaction.get(kegiatanRef);

  //         let currentLast = counterSnap.exists()
  //           ? counterSnap.data().lastNumber || 0
  //           : 0;
  //         const currentTotal = kegiatanSnap.data()?.totalPeserta || 0;

  //         transaction.set(
  //           counterDocRef,
  //           {
  //             lastNumber: currentLast,
  //             updatedAt: serverTimestamp(),
  //           },
  //           { merge: true },
  //         );

  //         transaction.set(newPesertaDocRef, {
  //           nama: peserta.nama,
  //           email: cleanEmail,
  //           instansi: peserta.instansi || "-",
  //           jabatan: peserta.jabatan || "-",
  //           nomorSertifikat: peserta.nomorSertifikat,
  //           sertifikatTerkirim: true,
  //           waktuPresensi: serverTimestamp(),
  //         });

  //         transaction.update(kegiatanRef, {
  //           totalPeserta: currentTotal + 1,
  //         });
  //       });

  //       successCount++;
  //     } catch (err) {
  //       failCount++;
  //       console.error(`Gagal untuk ${peserta.nama}:`, err.message);
  //     }

  //     setProgressState((prev) => ({
  //       ...prev,
  //       success: successCount,
  //       failed: failCount,
  //       skipped: skipCount,
  //     }));

  //     // 3. JEDA 2 DETIK
  //     if (i < total - 1) {
  //       for (let sec = 2; sec >= 1; sec--) {
  //         setProgressState((prev) => ({
  //           ...prev,
  //           statusText: "Menunggu antrean berikutnya...",
  //           countdown: sec,
  //         }));
  //         await new Promise((resolve) => setTimeout(resolve, 1000));
  //       }
  //       setProgressState((prev) => ({ ...prev, countdown: 0 }));
  //     }
  //   }

  //   setProgressState((prev) => ({
  //     ...prev,
  //     statusText: "Selesai!",
  //     currentNama: "Semua antrean import beres.",
  //     countdown: 0,
  //   }));

  //   window.removeEventListener("beforeunload", handleBeforeUnload);
  //   toast.success(
  //     `Selesai! Berhasil: ${successCount}, Dilewati (Sudah Ada): ${skipCount}, Gagal: ${failCount}`,
  //     { duration: 8000 },
  //   );
  // };
  return (
    <>
      {isOpen && kegiatan && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Import CSV Daftar Hadir
                  </h3>
                  <p className="text-xs text-slate-400 truncate max-w-xs">
                    {kegiatan.namaKegiatan || kegiatan.nama}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="bg-blue-950/30 border border-blue-800/40 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-blue-200">
                    Belum punya format CSV?
                  </p>
                  <p className="text-[11px] text-blue-400">
                    Unduh contoh template dengan header nama, email,
                    nomorSertifikat.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0"
                >
                  <Download className="w-3.5 h-3.5" /> Template
                </button>
              </div>

              <div className="border-2 border-dashed border-slate-700 hover:border-blue-500/50 bg-slate-800/30 rounded-2xl p-6 text-center transition-all relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-200">
                  {file ? file.name : "Klik atau seret file CSV ke sini"}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Hanya file format .CSV yang didukung
                </p>
              </div>

              {parsedData.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-slate-300">
                    Pratinjau Data:{" "}
                    <strong>{parsedData.length} Peserta SIAP DIPROSES</strong>
                  </div>
                  <div className="max-h-44 overflow-y-auto bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 text-[11px]">
                    {parsedData.slice(0, 10).map((p, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center text-slate-400 border-b border-slate-800/50 pb-1"
                      >
                        <div className="truncate pr-2">
                          <span className="font-medium text-slate-200 block truncate">
                            {p.nama}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate block">
                            {p.email || "Tanpa Email"}
                          </span>
                        </div>
                        <span className="text-indigo-400 shrink-0 text-[10px] bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                          {p.nomorSertifikat}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-800/30 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleProcessImport}
                disabled={parsedData.length === 0}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-4 h-4" /> Kirim Sertifikat (
                {parsedData.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING PROGRESS WIDGET */}
      {progressState.active && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 border border-slate-700 w-80 rounded-2xl shadow-2xl overflow-hidden text-white transition-all">
          <div className="p-3 bg-slate-800 flex items-center justify-between border-b border-slate-700">
            <div className="flex items-center gap-2">
              {progressState.current < progressState.total ? (
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
              <span className="text-xs font-bold">
                {progressState.current < progressState.total
                  ? "Mengirim Sertifikat..."
                  : "Pengiriman Selesai!"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setProgressState((prev) => ({
                    ...prev,
                    minimized: !prev.minimized,
                  }))
                }
                className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
              >
                {progressState.minimized ? (
                  <Maximize2 className="w-3.5 h-3.5" />
                ) : (
                  <Minimize2 className="w-3.5 h-3.5" />
                )}
              </button>
              {progressState.current >= progressState.total && (
                <button
                  onClick={() =>
                    setProgressState((prev) => ({ ...prev, active: false }))
                  }
                  className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {!progressState.minimized && (
            <div className="p-4 space-y-3 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Progress:</span>
                <span className="font-semibold text-slate-200">
                  {progressState.current} dari {progressState.total}
                </span>
              </div>

              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{
                    width: `${(progressState.current / progressState.total) * 100}%`,
                  }}
                ></div>
              </div>

              {/* COUNTDOWN WIDGET */}
              {progressState.countdown > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl flex items-center justify-between">
                  <span className="text-amber-300 flex items-center gap-1.5 font-medium">
                    <Timer className="w-4 h-4 animate-pulse" /> Jeda Berikutnya:
                  </span>
                  <span className="font-mono font-bold text-amber-400 text-sm bg-amber-500/20 px-2 py-0.5 rounded">
                    00:0{progressState.countdown}
                  </span>
                </div>
              )}

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  Sedang Memproses:
                </p>
                <p className="font-medium text-slate-200 truncate">
                  {progressState.currentNama || "Menyiapkan..."}
                </p>
                <p className="text-[10px] text-blue-400 italic">
                  {progressState.statusText}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-1 text-[10px] pt-1 border-t border-slate-800 text-center">
                <span className="text-emerald-400">
                  ✓ Berhasil: {progressState.success}
                </span>
                <span className="text-amber-400">
                  ⚡ Dilewati: {progressState.skipped}
                </span>
                <span className="text-rose-400">
                  ✕ Gagal: {progressState.failed}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default ImportCsvModal;
