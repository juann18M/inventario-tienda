"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  User, Mail, Lock, Building, ArrowRight, 
  Loader2, Eye, EyeOff, ChevronDown, Check, AlertCircle
} from "lucide-react";

const SUCURSALES = [
  { id: 1, nombre: "Centro Isidro Huarte 1" },
  { id: 2, nombre: "Centro Isidro Huarte 2" },
  { id: 3, nombre: "Santiago Tapia" },
  { id: 4, nombre: "Guadalupe Victoria" },
];

export default function PaginaRegistro() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState("empleado");
  const [sucursalId, setSucursalId] = useState<number | "">("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState("");
  const [emailExistente, setEmailExistente] = useState(false);

  const verificarEmailExistente = async (email: string): Promise<boolean> => {
    try {
      // Si no tienes endpoint de verificación, puedes omitir esta función
      // o verificar después de intentar registrar
      return false;
    } catch (error) {
      return false;
    }
  };

  const manejarCambioCorreo = async (valor: string) => {
    setCorreo(valor);
    setEmailExistente(false);
    setError("");
  };

  async function manejarRegistro(e: React.FormEvent) {
    e.preventDefault();
    
    // Validaciones básicas
    if (rol === "empleado" && !sucursalId) {
      setError("Por favor selecciona una sucursal");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (!correo.includes('@')) {
      setError("Por favor ingresa un email válido");
      return;
    }

    setCargando(true);
    setError("");
    setEmailExistente(false);

    try {
      // Realizar el registro directamente
      const respuesta = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nombre: nombre.trim(),
          correo: correo.toLowerCase().trim(),
          password: password,
          rol: rol,
          sucursal_id: rol === "empleado" ? sucursalId : null,
        }),
      });

      const data = await respuesta.json();

      if (!respuesta.ok) {
        // Si el error es porque el email ya existe
        if (data.error && (data.error.includes("email") || data.error.includes("registrado"))) {
          setEmailExistente(true);
          setError("Este email ya está registrado");
        } else {
          setError(data.error || "Error en el registro");
        }
        setCargando(false);
        return;
      }

      // Registro exitoso
      setExito(true);
      
      // Redirigir al login después de 2 segundos
      setTimeout(() => {
        router.push("/login");
      }, 2000);

    } catch (error: any) {
      console.error("Error de registro:", error);
      setError("Error en el registro. Intenta nuevamente.");
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
        
        {/* Indicador de éxito */}
        {exito && (
          <div className="absolute top-3 right-3 z-10">
            <div className="bg-emerald-500 text-white p-1.5 rounded-full animate-in zoom-in duration-500">
              <Check className="w-3 h-3" />
            </div>
          </div>
        )}

        <div className="p-4 sm:p-5 md:p-6">
          {/* Encabezado más compacto */}
          <div className="mb-4 sm:mb-5 text-center">
            <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/5 mb-2">
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black" />
            </div>
            <h2 className="text-sm sm:text-base font-semibold text-zinc-900">Crear Cuenta</h2>
            <p className="text-[11px] sm:text-xs text-zinc-500">Completa los datos para registrarte</p>
          </div>

          {/* Estado de éxito */}
          {exito ? (
            <div className="text-center py-4 sm:py-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-emerald-100 mb-3">
                <Check className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-zinc-900 mb-1">¡Registro Exitoso!</h3>
              <p className="text-xs text-zinc-500">Redirigiendo al login...</p>
            </div>
          ) : (
            <form onSubmit={manejarRegistro} className="space-y-3 sm:space-y-4">
              {/* Campo Nombre */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-zinc-700 uppercase ml-1 flex items-center gap-1">
                  <span>Nombre</span>
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full bg-zinc-50 text-sm rounded-lg border border-zinc-300 px-3 py-2.5 pl-9 focus:ring-1 focus:ring-black/20 focus:border-black outline-none transition-all duration-200 placeholder:text-zinc-400"
                    placeholder="Nombre completo"
                    disabled={cargando}
                  />
                  <User className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400 group-focus-within:text-black transition-colors" />
                </div>
              </div>

              {/* Campo Email */}
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
                    onChange={(e) => manejarCambioCorreo(e.target.value)}
                    className={`w-full bg-zinc-50 text-sm rounded-lg border px-3 py-2.5 pl-9 focus:ring-1 focus:outline-none transition-all duration-200 placeholder:text-zinc-400
                      ${emailExistente ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-zinc-300 focus:border-black focus:ring-black/20'}`}
                    placeholder="correo@ejemplo.com"
                    disabled={cargando}
                  />
                  <Mail className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400 group-focus-within:text-black transition-colors" />
                  {emailExistente && (
                    <AlertCircle className="absolute right-3 top-2.5 w-3.5 h-3.5 text-red-500" />
                  )}
                </div>
                {emailExistente && (
                  <p className="text-[11px] text-red-500 ml-1 animate-in fade-in">
                    Este email ya está registrado
                  </p>
                )}
              </div>

              {/* Grid Contraseña y Rol */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                      onChange={(e) => setPassword(e.target.value)}
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
                
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-700 uppercase ml-1">Rol</label>
                  <div className="relative">
                    <select
                      value={rol}
                      onChange={(e) => setRol(e.target.value)}
                      className="w-full bg-zinc-50 text-sm rounded-lg border border-zinc-300 px-3 py-2.5 appearance-none focus:ring-1 focus:ring-black/20 focus:border-black outline-none transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
                      disabled={cargando}
                    >
                      <option value="empleado">Empleado</option>
                      <option value="admin">Administrador</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Campo Sucursal (condicional) */}
              {rol === "empleado" && (
                <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="text-[11px] font-medium text-zinc-700 uppercase ml-1 flex items-center gap-1">
                    <span>Sucursal</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <div className="relative group">
                    <select
                      required
                      value={sucursalId}
                      onChange={(e) => setSucursalId(Number(e.target.value))}
                      className="w-full bg-zinc-50 text-sm rounded-lg border border-zinc-300 px-3 py-2.5 pl-9 appearance-none focus:ring-1 focus:ring-black/20 focus:border-black outline-none transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
                      disabled={cargando}
                    >
                      <option value="">Seleccionar sucursal...</option>
                      {SUCURSALES.map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </select>
                    <Building className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400 group-focus-within:text-black" />
                    <ChevronDown className="absolute right-3 top-2.5 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Mensaje de error general */}
              {error && !emailExistente && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                  <div className="flex items-center gap-2 text-[11px] text-red-600 font-medium bg-red-50 py-2 px-2.5 rounded-lg border border-red-100">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* Botón de registro */}
              <button
                type="submit"
                disabled={cargando || emailExistente}
                className="w-full bg-black text-white h-10 rounded-lg text-xs font-bold hover:bg-zinc-800 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 mt-1 disabled:opacity-70 disabled:cursor-not-allowed group"
              >
                {cargando ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>REGISTRANDO...</span>
                  </>
                ) : (
                  <>
                    <span>CREAR CUENTA</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Enlace a inicio de sesión */}
          <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-zinc-100 text-center">
            <button 
              onClick={() => router.push("/login")}
              className="text-[11px] text-zinc-500 hover:text-black transition-colors duration-200 uppercase tracking-widest font-medium flex items-center justify-center gap-2 group"
              disabled={cargando || exito}
            >
              <span>¿Ya tienes cuenta?</span>
              <span className="font-bold group-hover:underline">Iniciar Sesión</span>
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