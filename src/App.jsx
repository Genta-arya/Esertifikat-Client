import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';


// Import Halaman
import LoginPage from './pages/Admin/LoginPage';
import DashboardPage from './pages/Admin/DashboardPage'; // Buat file komponen ini jika belum ada

import CreateKegiatan from './pages/Admin/CreateKegiatan';
import FormPresensi from './pages/FormPresensi';
import { auth } from './utils/Firebase';

// Komponen Proteksi Rute (Protected Route)
const ProtectedRoute = ({ user, loading, children }) => {
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm">Memeriksa autentikasi...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Merekam perubahan status Auth Firebase (Login / Logout / Refresh Page)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    // Cleanup listener saat komponen unmount
    return () => unsubscribe();
  }, []);

  return (
    <Router>
      <Routes>
        {/* Rute 1: Login Page */}
        {/* Jika user sudah login, buka /login akan otomatis di-redirect ke Dashboard */}
        <Route 
          path="/login" 
          element={user ? <Navigate to="/admin/dashboard" replace /> : <LoginPage />} 
        />

        {/* Rute 2: Dashboard Admin (Hanya bisa diakses jika sudah login) */}
        <Route 
          path="/admin/dashboard" 
          element={
            <ProtectedRoute user={user} loading={loading}>
              <DashboardPage user={user} />
            </ProtectedRoute>
          }

        />
        <Route 
          path="/admin/kegiatan/buat" 
          element={
            <ProtectedRoute user={user} loading={loading}>
              <CreateKegiatan />
            </ProtectedRoute>
          }

        />

        {/* Rute 3: Form Presensi Peserta (Public, Tidak Perlu Login Admin) */}
        {/* <Route path="/presensi/:kegiatanId" element={<FormPresensiPublic />} /> */}

        {/* Rute Default / Fallback */}
        <Route 
          path="/" 
          element={<Navigate to={user ? "/admin/dashboard" : "/login"} replace />} 
        />

        <Route path='/kegiatan/:slug' element={<FormPresensi />} />
       

        {/* Rute 404 Not Found */}
        <Route 
          path="*" 
          element={
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
              <h1 className="text-6xl font-bold text-blue-500 mb-2">404</h1>
              <p className="text-slate-400 text-lg mb-4">Halaman Tidak Ditemukan</p>
              
            </div>
          } 
        />
      </Routes>
    </Router>
  );
};

export default App;