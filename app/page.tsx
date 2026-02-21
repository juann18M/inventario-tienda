"use client";

import Sidebar from "./components/Sidebar";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  ClipboardList,
  Settings2,
  X,
  ChevronRight,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Bell,
  Package,
  ShoppingBag,
} from "lucide-react";

// ✅ TIPO CORREGIDO: ahora usa sucursal_nombre y sucursal_id
type SessionUser = {
  name?: string | null;
  role?: string;
  sucursal_nombre?: string | null; // 👈 campo correcto para el nombre
  sucursal_id?: number;             // 👈 nuevo campo para el ID
  id?: number;
};

interface Notificacion {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: 'venta' | 'apartado' | 'inventario' | 'caja';
  fecha: Date;
  leida: boolean;
  link: string;
}

const SUCURSALES_LISTA = [
  "Centro Isidro Huarte 1",
  "Centro Isidro Huarte 2",
  "Santiago Tapia",
  "Guadalupe Victoria"
];

export default function Home() {
  const { data: session, status } = useSession();

  const [rol, setRol] = useState("");
  const [sucursalActiva, setSucursalActiva] = useState<string | null>(null);
  const [cajaId, setCajaId] = useState<number | null>(null);
  const [montoInicial, setMontoInicial] = useState<number | "">("");
  const [montoFinal, setMontoFinal] = useState<number | "">("");

  const [ventasHoy, setVentasHoy] = useState(0);
  const [apartadosActivos, setApartadosActivos] = useState(0);
  const [apartadosPendientes, setApartadosPendientes] = useState(0);
  const [ventasCount, setVentasCount] = useState(0);
  const [stockBajo, setStockBajo] = useState(0);
  const [ventasSemana, setVentasSemana] = useState<number[]>([]);
  
  // Estados para alertas inteligentes
  const [productosLentos, setProductosLentos] = useState<any[]>([]);
  const [clientesPendientesHoy, setClientesPendientesHoy] = useState<any[]>([]);
  const [productoTopHoy, setProductoTopHoy] = useState<any>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [modalMontoInicial, setModalMontoInicial] = useState(false);
  const [modalActualizarCaja, setModalActualizarCaja] = useState(false);
  const [modalMontoFinal, setModalMontoFinal] = useState(false);
  const [tabCaja, setTabCaja] = useState<"inicial" | "final">("inicial");
  
  // Sistema de notificaciones
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [mostrarNotificaciones, setMostrarNotificaciones] = useState(false);
  const [notificacionesNoLeidas, setNotificacionesNoLeidas] = useState(0);

  const addNotificacion = (titulo: string, mensaje: string, tipo: 'venta' | 'apartado' | 'inventario' | 'caja', link: string) => {
    const notifKey = `${tipo}_${new Date().toDateString()}_${titulo}`;
    const yaExiste = sessionStorage.getItem(notifKey);
    
    if (!yaExiste) {
      const nuevaNotificacion: Notificacion = {
        id: Date.now(),
        titulo,
        mensaje,
        tipo,
        fecha: new Date(),
        leida: false,
        link
      };
      
      setNotificaciones(prev => [nuevaNotificacion, ...prev].slice(0, 10));
      setNotificacionesNoLeidas(prev => prev + 1);
      sessionStorage.setItem(notifKey, "true");
    }
  };

  const marcarComoLeida = (id: number) => {
    setNotificaciones(prev => 
      prev.map(not => not.id === id ? { ...not, leida: true } : not)
    );
    setNotificacionesNoLeidas(prev => Math.max(0, prev - 1));
  };

  const marcarTodasLeidas = () => {
    setNotificaciones(prev => 
      prev.map(not => ({ ...not, leida: true }))
    );
    setNotificacionesNoLeidas(0);
  };

  /* ================= HELPERS ================= */

  const obtenerCajaActual = async (sucursal?: string) => {
    const sucursalAUsar = sucursal || sucursalActiva;
    if (!sucursalAUsar) return null;

    try {
      const res = await fetch(
        `/api/dashboard/caja?sucursal=${encodeURIComponent(sucursalAUsar)}`,
        { cache: 'no-store' }
      );
      const json = await res.json();
      
      if (json?.data && json.data.length > 0) {
        return json.data[0];
      }
      return null;
    } catch (error) {
      console.error("Error al obtener caja:", error);
      return null;
    }
  };

  const sincronizarCaja = async (sucursal: string) => {
    try {
      console.log("🔍 Sincronizando caja para:", sucursal);

      const res = await fetch(
        `/api/dashboard/caja?sucursal=${encodeURIComponent(sucursal)}`
      );

      const json = await res.json();
      console.log("📦 Respuesta completa:", json);

      const caja = json.data?.[0];
      console.log("💰 Caja encontrada:", caja);

      if (caja) {
        console.log("✅ Caja existe:", {
          id: caja.id,
          inicial: caja.monto_inicial,
          final: caja.monto_final
        });

        setCajaId(caja.id);
        setMontoInicial(Number(caja.monto_inicial || 0));
        setMontoFinal(Number(caja.monto_final || 0));

        return true;
      } else {
        console.log("❌ No hay caja para hoy");

        setCajaId(null);
        setMontoInicial(0);
        setMontoFinal(0);

        return false;
      }
    } catch (error) {
      console.error("Error sincronizando caja:", error);
      return false;
    }
  };

  /* ================= DATA ================= */

  const fetchDashboardData = useCallback(
    async (sucursal: string) => {
      try {
        setIsLoading(true);
        
        console.log("📊 Fetching data para sucursal:", sucursal);

        const user = session?.user as SessionUser;
        const isAdmin = user?.role?.toLowerCase() === "admin";

        // Caja - SOLO para empleados
        if (!isAdmin) {
          const cajaExiste = await sincronizarCaja(sucursal);

          const storageKey = `caja_apertura_${sucursal}_${new Date().toDateString()}`;
          const yaPreguntada = sessionStorage.getItem(storageKey);

          if (!cajaExiste && !yaPreguntada) {
            console.log("🆕 Mostrando modal de apertura");
            setModalMontoInicial(true);
            sessionStorage.setItem(storageKey, "true");
          }
        } else {
          setCajaId(null);
          setMontoInicial(0);
          setMontoFinal(0);
        }

        // Estadísticas
        const resStats = await fetch(
          `/api/dashboard/stats?sucursal=${encodeURIComponent(sucursal)}`,
          { cache: 'no-store' }
        );
        const jsonStats = await resStats.json();

        if (jsonStats.success) {
          setVentasHoy(Number(jsonStats.totalVentas || 0));
          setApartadosActivos(Number(jsonStats.apartadosActivos || 0));
          setApartadosPendientes(Number(jsonStats.apartadosPendientes || 0));
          setVentasCount(Number(jsonStats.cantidadVentas || 0));
          setStockBajo(Number(jsonStats.stockBajo || 0));
          setVentasSemana(jsonStats.ventasSemana || [0,0,0,0,0,0,0]);
          
          // Datos para alertas
          setProductosLentos(jsonStats.productosLentos || []);
          setClientesPendientesHoy(jsonStats.clientesPendientes || []);
          setProductoTopHoy(jsonStats.productoTopHoy || null);
          
          // Notificaciones
          if (jsonStats.apartadosPendientes > 0) {
            addNotificacion(
              "Apartados Pendientes",
              `${jsonStats.apartadosPendientes} apartado${jsonStats.apartadosPendientes !== 1 ? 's' : ''} por cobrar hoy`,
              'apartado',
              '/apartados?filter=pendientes'
            );
          }
          
          if (jsonStats.stockBajo > 0) {
            addNotificacion(
              "Stock Bajo",
              `${jsonStats.stockBajo} producto${jsonStats.stockBajo !== 1 ? 's' : ''} con stock crítico`,
              'inventario',
              '/inventario?filter=stockBajo'
            );
          }
        }
      } catch (err) {
        console.error("Error dashboard:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [session]
  );

  /* ================= EFFECT ================= */

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;

    // ✅ LÓGICA CORREGIDA PARA SUCURSALES
    const user = session.user as SessionUser;
    const userRol = String(user.role || "").toLowerCase();
    setRol(userRol);

    let sucursal: string | null = null;

    // Los admin pueden cambiar de sucursal (guardada en localStorage)
    if (userRol === "admin") {
      sucursal = localStorage.getItem("sucursalActiva") || SUCURSALES_LISTA[0];
      console.log("👑 Admin usando sucursal:", sucursal);
    } else {
      // Los empleados tienen su sucursal fija del perfil
      sucursal = user.sucursal_nombre || null; // 👈 ahora usa el campo correcto
      console.log("🧑‍💼 Empleado con sucursal asignada:", sucursal);
    }

    // Validación crítica
    if (!sucursal) {
      console.error("⛔ Usuario sin sucursal asignada", { user, userRol });
      // Aquí podrías mostrar un mensaje de error al usuario
      return;
    }

    setSucursalActiva(sucursal);
    fetchDashboardData(sucursal);
    
    addNotificacion(
      "Bienvenido",
      `Has iniciado sesión en ${sucursal}`,
      'caja',
      '/'
    );
    
  }, [status, session, fetchDashboardData]);

  /* ================= HANDLERS ================= */

  const handlerGuardarInicial = async () => {
    if (!montoInicial || Number(montoInicial) <= 0) return;

    try {
      console.log("📤 Enviando datos:", {
        monto_inicial: Number(montoInicial),
        sucursal: sucursalActiva
      });

      const res = await fetch("/api/dashboard/caja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto_inicial: Number(montoInicial),
          sucursal: sucursalActiva
        })
      });

      const json = await res.json();
      console.log("📥 Respuesta:", { status: res.status, ok: res.ok, data: json });

      if (!res.ok && json.error?.includes("Ya existe")) {
        console.log("Caja ya existía, sincronizando...");
        
        await sincronizarCaja(sucursalActiva!);
        setModalMontoInicial(false);
        return;
      }

      if (res.ok) {
        await sincronizarCaja(sucursalActiva!);
        setModalMontoInicial(false);
        
        addNotificacion(
          "Caja Abierta",
          `Caja aperturada con $${Number(montoInicial).toLocaleString('es-MX')}`,
          'caja',
          '/'
        );
      } else {
        alert(json.error || "Error al abrir caja");
      }

    } catch (error) {
      console.error("Error al abrir caja:", error);
      alert("Error de conexión al abrir caja");
    }
  };

  const handlerActualizar = async () => {
    try {
      const caja = await obtenerCajaActual();
      if (!caja) return;

      const res = await fetch("/api/dashboard/caja", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: caja.id,
          monto_inicial: tabCaja === "inicial" ? Number(montoInicial) : undefined,
          monto_final: tabCaja === "final" ? Number(montoFinal) : undefined
        })
      });

      if (res.ok) {
        setModalActualizarCaja(false);
        await sincronizarCaja(sucursalActiva!);
        
        addNotificacion(
          "Caja Actualizada",
          `Monto ${tabCaja} actualizado a $${(tabCaja === "inicial" ? Number(montoInicial) : Number(montoFinal)).toLocaleString('es-MX')}`,
          'caja',
          '/'
        );
      }
    } catch (error) {
      console.error("Error al actualizar:", error);
    }
  };

  const handleCambioSucursal = async (nuevaSucursal: string) => {
    setSucursalActiva(nuevaSucursal);

    if (rol === "admin") {
      localStorage.setItem("sucursalActiva", nuevaSucursal);
    }

    setCajaId(null);
    setMontoInicial(0);
    setMontoFinal(0);

    await fetchDashboardData(nuevaSucursal);
  };

  const handlerFinalizar = async () => {
    try {
      const caja = await obtenerCajaActual();

      if (caja) {
        if (!montoFinal || Number(montoFinal) <= 0) return;

        await fetch("/api/dashboard/caja", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: caja.id,
            monto_final: Number(montoFinal)
          })
        });
      }

      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith('caja_apertura_')) {
          sessionStorage.removeItem(key);
        }
      });

      setTimeout(() => {
        signOut({ callbackUrl: "/login" });
      }, 500);
      
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  const handleCerrarSesion = async () => {
    const caja = await obtenerCajaActual();
    if (caja && Number(caja.monto_final) === 0) {
      setModalMontoFinal(true);
    } else {
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith('caja_apertura_')) {
          sessionStorage.removeItem(key);
        }
      });
      signOut({ callbackUrl: "/login" });
    }
  };

  /* ================= UI ================= */

  if (status === "loading" || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-black mx-auto" />
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F9F9FB]">
      <Sidebar onCerrarSesion={handleCerrarSesion} />

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
        {/* Header */}
        <header className="mb-8 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg flex flex-col justify-center min-w-[140px]">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Estado</span>
              <span className="text-xs font-bold text-black uppercase leading-none">
                {new Date().getHours() < 12 ? "☀️ Buenos días" : new Date().getHours() < 18 ? "🌤️ Buenas tardes" : "🌙 Buenas noches"}
              </span>
            </div>

            <div className="bg-black text-white px-4 py-2 rounded-lg flex flex-col justify-center">
              <span className="text-[9px] font-black opacity-60 uppercase tracking-widest">Panel</span>
              <span className="text-xs font-bold uppercase">Control</span>
            </div>

            <div className="bg-white border border-slate-200 px-4 py-2 rounded-lg flex flex-col justify-center">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Operador</span>
              <span className="text-xs font-bold text-black uppercase leading-none">
                {session?.user?.name || "Sin Usuario"}
              </span>
            </div>

            <div className={`bg-white border ${rol === "admin" ? "border-blue-500" : "border-slate-200"} px-4 py-2 rounded-lg flex flex-col justify-center`}>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Localización</span>
              {rol === "admin" ? (
                <select 
                  value={sucursalActiva || ""} 
                  onChange={(e) => handleCambioSucursal(e.target.value)}
                  className="text-xs font-bold text-black uppercase bg-transparent outline-none cursor-pointer"
                >
                  {SUCURSALES_LISTA.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-bold text-black uppercase leading-none">
                  {sucursalActiva || "Cargando..."}
                </span>
              )}
              {/* DEBUG: muestra la sucursal real */}
              <span className="text-[6px] text-gray-300 mt-1">
                ID: {sucursalActiva}
              </span>
            </div>
          </div>

          {/* Campanita de notificaciones */}
          <div className="relative">
            <button 
              onClick={() => setMostrarNotificaciones(!mostrarNotificaciones)}
              className="relative p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
            >
              <Bell size={20} className="text-slate-600" />
              {notificacionesNoLeidas > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {notificacionesNoLeidas > 9 ? '9+' : notificacionesNoLeidas}
                </span>
              )}
            </button>

            {/* Panel de notificaciones */}
            {mostrarNotificaciones && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Notificaciones</h3>
                  {notificacionesNoLeidas > 0 && (
                    <button 
                      onClick={marcarTodasLeidas}
                      className="text-[9px] font-bold text-blue-600 uppercase hover:text-blue-800"
                    >
                      Marcar todas
                    </button>
                  )}
                </div>
                
                <div className="max-h-96 overflow-y-auto">
                  {notificaciones.length === 0 ? (
                    <div className="p-8 text-center">
                      <Bell size={24} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">No hay notificaciones</p>
                    </div>
                  ) : (
                    notificaciones.map((notif) => (
                      <Link
                        key={notif.id}
                        href={notif.link}
                        onClick={() => {
                          marcarComoLeida(notif.id);
                          setMostrarNotificaciones(false);
                        }}
                        className={`block p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                          !notif.leida ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            notif.tipo === 'venta' ? 'bg-emerald-100 text-emerald-600' :
                            notif.tipo === 'apartado' ? 'bg-orange-100 text-orange-600' :
                            notif.tipo === 'inventario' ? 'bg-red-100 text-red-600' :
                            'bg-blue-100 text-blue-600'
                          }`}>
                            {notif.tipo === 'venta' && <ShoppingBag size={14} />}
                            {notif.tipo === 'apartado' && <ClipboardList size={14} />}
                            {notif.tipo === 'inventario' && <Package size={14} />}
                            {notif.tipo === 'caja' && <Wallet size={14} />}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <h4 className="text-xs font-black text-slate-800">{notif.titulo}</h4>
                              <span className="text-[8px] text-slate-400">
                                {new Date(notif.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-600 mt-1">{notif.mensaje}</p>
                          </div>
                          {!notif.leida && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full mt-2"></span>
                          )}
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Cards principales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {/* CAJA INICIAL */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                <Wallet size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Caja Inicial</p>
                <p className="text-lg font-bold text-slate-800">
                  {montoInicial && Number(montoInicial) > 0 ? `$${Number(montoInicial).toLocaleString("es-MX")}` : '—'}
                </p>
              </div>
            </div>
            {montoInicial && Number(montoInicial) > 0 && (
              <button 
                onClick={() => { setTabCaja("inicial"); setModalActualizarCaja(true); }}
                className="p-2 text-slate-300 hover:text-blue-600 transition-colors"
              >
                <Settings2 size={16} />
              </button>
            )}
          </div>

          {/* CAJA FINAL */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
                <DollarSign size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Caja Final</p>
                <p className="text-lg font-bold text-slate-800">
                  {montoFinal && Number(montoFinal) > 0 ? `$${Number(montoFinal).toLocaleString("es-MX")}` : '—'}
                </p>
              </div>
            </div>
            {montoFinal && Number(montoFinal) > 0 && (
              <button 
                onClick={() => { setTabCaja("final"); setModalActualizarCaja(true); }}
                className="p-2 text-slate-300 hover:text-purple-600 transition-colors"
              >
                <Settings2 size={16} />
              </button>
            )}
          </div>

          {/* VENTAS HOY */}
          <Link href="/ventas" className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all">
            <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Ventas Hoy</p>
              <p className="text-lg font-bold text-slate-800">${ventasHoy.toLocaleString("es-MX")}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">{ventasCount} transacciones</p>
            </div>
          </Link>

          {/* APARTADOS */}
          <Link href="/apartados" className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all">
            <div className="w-9 h-9 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
              <ClipboardList size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Apartados</p>
              <p className="text-lg font-bold text-slate-800">{apartadosActivos}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                {apartadosPendientes > 0 ? `${apartadosPendientes} pendiente${apartadosPendientes !== 1 ? 's' : ''}` : 'Activos'}
              </p>
            </div>
          </Link>
        </div>

        {/* Alerta de stock bajo */}
        {stockBajo > 0 && (
          <Link 
            href="/inventario?filter=stockBajo" 
            className="mb-3 block bg-amber-50 border border-amber-200 rounded-xl p-3 hover:bg-amber-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600" />
              <span className="text-xs font-bold text-amber-800 uppercase">
                {stockBajo} producto{stockBajo !== 1 ? 's' : ''} con stock bajo
              </span>
              <ChevronRight size={14} className="text-amber-400 ml-auto" />
            </div>
          </Link>
        )}

        {/* Alertas inteligentes */}
        <div className="mt-8">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-3 ml-1 tracking-widest">ALERTAS INTELIGENTES</h3>
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="space-y-3">
              
              {/* Producto lento */}
              {productosLentos && productosLentos.length > 0 && (
                <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-xl">
                  <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs">🎯</div>
                  <div>
                    <p className="text-[9px] font-bold text-emerald-800">RECOMENDACIÓN</p>
                    <p className="text-xs text-slate-700">
                      Ofrece descuento en <span className="font-bold">{productosLentos[0].nombre}</span> - 
                      lleva <span className="font-bold">{productosLentos[0].diasSinVender} días</span> sin venderse
                      {productosLentos[0].stock > 0 && ` (${productosLentos[0].stock} en stock)`}
                    </p>
                  </div>
                </div>
              )}

              {/* Cliente pendiente hoy */}
              {clientesPendientesHoy && clientesPendientesHoy.length > 0 && (
                <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-xl">
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs">📊</div>
                  <div>
                    <p className="text-[9px] font-bold text-purple-800">OPORTUNIDAD</p>
                    <p className="text-xs text-slate-700">
                      Cliente <span className="font-bold">{clientesPendientesHoy[0].cliente}</span> debe 
                      <span className="font-bold"> ${clientesPendientesHoy[0].saldo}</span> - 
                      <span className="text-purple-600"> vence hoy</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Stock crítico */}
              {stockBajo > 0 && (
                <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl">
                  <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">⚠️</div>
                  <div>
                    <p className="text-[9px] font-bold text-red-800">URGENTE</p>
                    <p className="text-xs text-slate-700">
                      <span className="font-bold">{stockBajo} producto{stockBajo !== 1 ? 's' : ''}</span> con stock crítico 
                      (menos de 3 unidades)
                    </p>
                  </div>
                </div>
              )}

              {/* Producto top hoy */}
              {productoTopHoy && (
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">🔥</div>
                  <div>
                    <p className="text-[9px] font-bold text-blue-800">TENDENCIA</p>
                    <p className="text-xs text-slate-700">
                      <span className="font-bold">{productoTopHoy.nombre}</span> es el más vendido hoy 
                      ({productoTopHoy.cantidad} unidad{productoTopHoy.cantidad !== 1 ? 'es' : ''})
                    </p>
                  </div>
                </div>
              )}

              {/* Sin ventas hoy */}
              {ventasHoy === 0 && (
                <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-xl">
                  <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center text-white text-xs">⏰</div>
                  <div>
                    <p className="text-[9px] font-bold text-yellow-800">ATENCIÓN</p>
                    <p className="text-xs text-slate-700">
                      Aún no hay ventas hoy. {new Date().getHours() < 12 ? '¡Es buen momento para comenzar!' : 'Activa promociones para impulsar ventas.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Comparativa vs ayer */}
              {(() => {
                const ayerIndex = new Date().getDay() - 2;
                const ventasAyer = ayerIndex >= 0 ? ventasSemana[ayerIndex] || 0 : 0;
                
                if (ventasHoy > ventasAyer && ventasAyer > 0) {
                  const aumento = ((ventasHoy - ventasAyer) / ventasAyer * 100).toFixed(0);
                  return (
                    <div className="flex items-start gap-3 p-3 bg-green-50 rounded-xl">
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">📈</div>
                      <div>
                        <p className="text-[9px] font-bold text-green-800">BUENAS NOTICIAS</p>
                        <p className="text-xs text-slate-700">
                          Las ventas van <span className="font-bold">+{aumento}%</span> respecto ayer
                        </p>
                      </div>
                    </div>
                  );
                } else if (ventasHoy < ventasAyer && ventasHoy > 0) {
                  const disminucion = ((ventasAyer - ventasHoy) / ventasAyer * 100).toFixed(0);
                  return (
                    <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-xl">
                      <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs">📉</div>
                      <div>
                        <p className="text-[9px] font-bold text-orange-800">ALERTA</p>
                        <p className="text-xs text-slate-700">
                          Las ventas están <span className="font-bold">-{disminucion}%</span> respecto ayer
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Todo bien */}
              {(!productosLentos || productosLentos.length === 0) && 
               (!clientesPendientesHoy || clientesPendientesHoy.length === 0) && 
               stockBajo === 0 && 
               ventasHoy > 0 && (
                <div className="text-center py-4">
                  <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Todo en orden. No hay alertas por el momento.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modal Apertura */}
      {modalMontoInicial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => {}}></div>
          <div className="relative bg-white w-full max-w-[320px] rounded-2xl shadow-2xl p-6 text-center animate-in zoom-in duration-200">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Apertura de Caja</h2>
            <p className="text-[11px] text-slate-400 mb-6 uppercase font-bold tracking-tighter">Monto Inicial</p>
            
            <div className="relative mb-8">
              <input 
                type="number"
                value={montoInicial}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "") {
                    setMontoInicial("");
                  } else {
                    setMontoInicial(Math.max(0, Number(value)));
                  }
                }}
                className="w-full text-3xl font-bold text-center outline-none text-slate-800"
                autoFocus
                min="0"
                step="0.01"
                placeholder="0.00"
              />
              <div className="w-12 h-[2px] bg-blue-500 mx-auto mt-1"></div>
            </div>

            <button 
              onClick={handlerGuardarInicial}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm transition-all hover:bg-blue-700"
            >
              Confirmar Apertura
            </button>
          </div>
        </div>
      )}

      {/* Modal Cierre */}
      {modalMontoFinal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setModalMontoFinal(false)}></div>
          <div className="relative bg-white w-full max-w-[320px] rounded-2xl shadow-2xl p-6 text-center animate-in zoom-in duration-200">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Corte de Caja</h2>
            <p className="text-[11px] text-slate-400 mb-6 uppercase font-bold tracking-tighter">Monto Final</p>
            
            <div className="relative mb-8">
              <input 
                type="number" 
                value={montoFinal}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "") {
                    setMontoFinal("");
                  } else {
                    setMontoFinal(Math.max(0, Number(value)));
                  }
                }}
                className="w-full text-3xl font-bold text-center outline-none text-slate-800"
                autoFocus
                min="0"
                step="0.01"
                placeholder="0.00"
              />
              <div className="w-12 h-[2px] bg-red-500 mx-auto mt-1"></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setModalMontoFinal(false)}
                className="py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm transition-all hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button 
                onClick={handlerFinalizar}
                className="py-3 bg-red-600 text-white rounded-xl font-bold text-sm transition-all hover:bg-red-700"
              >
                Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajustes */}
      {modalActualizarCaja && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setModalActualizarCaja(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-none duration-300">
            <div className="p-5">
              <div className="flex justify-between items-center mb-5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ajustes de Caja</span>
                <button onClick={() => setModalActualizarCaja(false)} className="text-slate-300 hover:text-slate-500">
                  <X size={18}/>
                </button>
              </div>

              <div className="flex bg-slate-50 p-1 rounded-lg mb-6">
                <button 
                  onClick={() => setTabCaja("inicial")} 
                  className={`flex-1 py-1.5 text-[10px] font-black rounded-md transition-all ${tabCaja === "inicial" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"}`}
                >
                  INICIAL
                </button>
                <button 
                  onClick={() => setTabCaja("final")} 
                  className={`flex-1 py-1.5 text-[10px] font-black rounded-md transition-all ${tabCaja === "final" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"}`}
                >
                  FINAL
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 mb-8 text-slate-800">
                <DollarSign size={20} className="text-slate-300" />
                <input 
                  type="number" 
                  value={tabCaja === "inicial" ? montoInicial : montoFinal}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "") {
                      tabCaja === "inicial" ? setMontoInicial("") : setMontoFinal("");
                    } else {
                      tabCaja === "inicial" 
                        ? setMontoInicial(Math.max(0, Number(value)))
                        : setMontoFinal(Math.max(0, Number(value)));
                    }
                  }}
                  className="w-32 text-3xl font-bold outline-none bg-transparent text-center"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>

              <button 
                onClick={handlerActualizar}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-blue-700"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}