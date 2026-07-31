import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../Config/Firebase';



const LoginPage = () => {
  const navigate = useNavigate();

  // State untuk form input
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // State UI
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Handler Login Firebase
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      // Autentikasi dengan Firebase Auth
      await signInWithEmailAndPassword(auth, email, password);
      
      // Redirect ke Dashboard Admin setelah sukses login
      navigate('/admin/dashboard');
    } catch (error) {
      console.error("Firebase Auth Error:", error.code);
      
      // Menerjemahkan Error Code dari Firebase ke Bahasa Indonesia
      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          setErrorMessage('Email atau kata sandi yang Anda masukkan salah.');
          break;
        case 'auth/invalid-email':
          setErrorMessage('Format alamat email tidak valid.');
          break;
        case 'auth/too-many-requests':
          setErrorMessage('Terlalu banyak percobaan login gagal. Silakan coba beberapa saat lagi.');
          break;
        default:
          setErrorMessage('Gagal masuk. Silakan periksa koneksi internet Anda.');
          break;
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handler Lupa Password
  const handleForgotPassword = async () => {
    if (!email) {
      setErrorMessage('Masukkan email Anda terlebih dahulu untuk mereset kata sandi.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage('Tautan reset kata sandi telah dikirim ke email Anda.');
      setErrorMessage('');
    } catch (error) {
      setErrorMessage('Gagal mengirim email reset kata sandi. Pastikan email sudah terdaftar.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      {/* Background Decorator / Glow Effect */}
      <div className="absolute top-1/4 left-1/3 w-72 h-72 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/3 w-72 h-72 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-slate-800/80 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-2xl p-8 relative z-10">
        
        {/* Header / Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600/10 border border-blue-500/20 rounded-2xl mb-4 text-blue-500">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-wide">
            Selamat Datang Kembali
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Masuk ke Sistem E-Sertifikat KPU Kabupaten Sekadau[cite: 1]
          </p>
        </div>

        {/* Alert Error Message */}
        {errorMessage && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center">
            {errorMessage}
          </div>
        )}

        {/* Alert Success Message */}
        {successMessage && (
          <div className="mb-6 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm text-center">
            {successMessage}
          </div>
        )}

        {/* Form Login */}
        <form onSubmit={handleLogin} className="space-y-5">
          {/* Input Email */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Alamat Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-5 h-5" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@domain.com"
                className="w-full pl-10 pr-4 py-3 bg-slate-900/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Input Password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Kata Sandi
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-11 py-3 bg-slate-900/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              {/* Button Toggle Show/Hide Password */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Action Links */}
          <div className="flex items-center justify-end text-sm">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-blue-400 hover:text-blue-300 transition-colors font-medium bg-transparent border-none cursor-pointer"
            >
              Lupa kata sandi?
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <span>Masuk Sekarang</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500 mt-8">
          © 2026 KPU Kabupaten Sekadau. All rights reserved.[cite: 1]
        </p>
      </div>
    </div>
  );
};

export default LoginPage;