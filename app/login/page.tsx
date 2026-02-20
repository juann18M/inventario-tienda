"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  Mail, Lock, ArrowRight, 
  Loader2, Eye, EyeOff, AlertCircle, Key, Shield
} from "lucide-react";

export default function LoginPage() {
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    if (!correo.includes('@')) {
      setError("Por favor ingresa un email válido");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setCargando(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        redirect: false,
        correo: correo.toLowerCase().trim(),
        password: password,
        callbackUrl: "/"
      });

      if (res?.error) {
        // Mostrar error específico
        if (res.error.includes("CredentialsSignin")) {
          setError("Usuario o contraseña incorrectos");
        } else {
          setError(res.error);
        }
      } else if (res?.url) {
        // Login exitoso - redirigir manualmente
        window.location.href = res.url;
      } else {
        // Redirigir por defecto
        router.push("/");
      }
    } catch (error: any) {
      console.error("Error en login:", error);
      setError("Error de conexión. Verifica tu conexión a internet.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-zinc-50 to-zinc-100 flex flex-col items-center justify-center p-3 sm:p-4">
      
      {/* Logo más compacto */}
      <div className="mb-3 sm:mb-4 text-center">
        <h1 className="text-xl sm:text-2xl font-bold tracking-[0.15em] text-black">BLACK'S BOUTIQUE</h1>
        <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-zinc-500 mt-0.5">Sistema de Gestión</p>
      </div>

      {/* Contenedor adaptable - Más compacto */}
      <div className="w-full max-w-sm sm:max-w-md bg-white/95 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-md border border-zinc-200/50">
        
        {/* Indicador de seguridad */}
        <div className="absolute top-3 right-3 z-10">
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-zinc-100">
            <Shield className="w-3 h-3 text-zinc-600" />
            <span className="text-[10px] font-medium text-zinc-700">Seguro</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 md:p-6">
          {/* Encabezado más compacto */}
          <div className="mb-4 sm:mb-5 text-center">
            <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/5 mb-2">
              <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black" />
            </div>
            <h2 className="text-sm sm:text-base font-semibold text-zinc-900">Iniciar Sesión</h2>
            <p className="text-[11px] sm:text-xs text-zinc-500">Acceso exclusivo al sistema</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
            {/* Campo Correo */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-700 uppercase ml-1 flex items-center gap-1">
                <span>Email</span>
                <span className="text-red-500">*</span>
              </label>
              <div className="relative group">
                <input
                  type="email"
                  required
                  value={correo}
                  onChange={(e) => {
                    setCorreo(e.target.value);
                    setError("");
                  }}
                  className="w-full bg-zinc-50 text-sm rounded-lg border border-zinc-300 px-3 py-2.5 pl-9 focus:ring-1 focus:ring-black/20 focus:border-black outline-none transition-all duration-200 placeholder:text-zinc-400"
                  placeholder="correo@ejemplo.com"
                  disabled={cargando}
                />
                <Mail className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400 group-focus-within:text-black transition-colors" />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-700 uppercase ml-1 flex items-center gap-1">
                <span>Contraseña</span>
                <span className="text-red-500">*</span>
              </label>
              <div className="relative group">
                <input
                  type={mostrarPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  className="w-full bg-zinc-50 text-sm rounded-lg border border-zinc-300 px-3 py-2.5 pl-9 pr-9 focus:ring-1 focus:ring-black/20 focus:border-black outline-none transition-all duration-200 placeholder:text-zinc-400"
                  placeholder="••••••••"
                  disabled={cargando}
                  minLength={6}
                />
                <Lock className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400 group-focus-within:text-black transition-colors" />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute right-3 top-2.5 w-3.5 h-3.5 text-zinc-400 hover:text-black transition-colors"
                  disabled={cargando}
                >
                  {mostrarPassword ? <EyeOff className="w-full h-full" /> : <Eye className="w-full h-full" />}
                </button>
              </div>
              <p className="text-[10px] text-zinc-400 ml-1">Mínimo 6 caracteres</p>
            </div>

            {/* Mensaje de error */}
            {error && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="flex items-center gap-2 text-[11px] text-red-600 font-medium bg-red-50 py-2 px-2.5 rounded-lg border border-red-100">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Botón de inicio de sesión */}
            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-black text-white h-10 rounded-lg text-xs font-bold hover:bg-zinc-800 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 mt-1 disabled:opacity-70 disabled:cursor-not-allowed group"
            >
              {cargando ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>VERIFICANDO...</span>
                </>
              ) : (
                <>
                  <span>ACCEDER AL SISTEMA</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Enlace de registro */}
          <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-zinc-100 text-center">
            <button 
              onClick={() => router.push("/register")}
              className="text-[11px] text-zinc-500 hover:text-black transition-colors duration-200 uppercase tracking-widest font-medium flex items-center justify-center gap-2 group"
              disabled={cargando}
            >
              <span>¿No tienes cuenta?</span>
              <span className="font-bold group-hover:underline">Crear Cuenta</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer más pequeño */}
      <p className="mt-3 sm:mt-4 text-[10px] text-zinc-500 tracking-[0.15em] shrink-0 uppercase">
        BLACK'S BOUTIQUE © {new Date().getFullYear()}
      </p>
    </div>
  );
}