"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/app/components/Sidebar";
import TablaVentas from "./components/TablaVentas";
import FiltrosVentas from "./components/FiltrosVentas";
import DetalleVentaModal from "./components/DetalleVentaModal";
import { 
  Download,
  Filter,
  RefreshCw,
  DollarSign,
  Store,
  TrendingUp,
  Package,
  X,
  Receipt,
  BarChart3,
  Globe
} from "lucide-react";

interface Venta {
  id: number;
  fecha: string;
  total: number;
  metodo_pago: string;
  cliente: string | null;
  observaciones: string | null;
  usuario_nombre: string;
  usuario_rol: string;
  sucursal_nombre: string;
  cantidad_productos: number;
}

interface Paginacion {
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
}

interface Usuario {
  id: number;
  nombre: string;
  correo: string;
  rol: string;
  sucursal_nombre: string;
}

interface Sucursal {
  id: number;
  nombre: string;
}

// Mapa de nombres de sucursales a IDs
const SUCURSALES_MAP: Record<string, number> = {
  "Centro Isidro Huarte 1": 1,
  "Centro Isidro Huarte 2": 2,
  "Santiago Tapia": 3,
  "Guadalupe Victoria": 4,
};

const ID_SUCURSALES_MAP: Record<number, string> = {
  1: "Centro Isidro Huarte 1",
  2: "Centro Isidro Huarte 2",
  3: "Santiago Tapia",
  4: "Guadalupe Victoria",
};

export default function HistorialVentasPage() {
  const { data: session, status } = useSession();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [paginacion, setPaginacion] = useState<Paginacion>({
    pagina: 1,
    limite: 20,
    total: 0,
    totalPaginas: 1
  });
  const [modalDetalle, setModalDetalle] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState<number | null>(null);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [mostrarEstadisticas, setMostrarEstadisticas] = useState(true);
  
  // ✅ ÚNICA FUENTE DE VERDAD: sucursalIdActiva
  const [sucursalIdActiva, setSucursalIdActiva] = useState<number | null>(null);
  // Estado para modo "Todas las sucursales" (solo admin)
  const [verTodasSucursales, setVerTodasSucursales] = useState(false);

  // Filtros
  const [filtros, setFiltros] = useState({
    fechaInicio: "",
    fechaFin: "",
    usuarioId: "",
    metodoPago: "",
    cliente: "",
    sucursalId: ""
  });

  const [filtrosActivos, setFiltrosActivos] = useState(0);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);

  // Escuchar cambios en localStorage para la sucursal activa (admin)
  useEffect(() => {
    const user = session?.user as any;
    const isAdmin = user?.role?.toLowerCase() === "admin";
    
    if (isAdmin && status === "authenticated") {
      // Función para actualizar la sucursal activa
      const actualizarSucursalActiva = () => {
        const sucursalGuardada = localStorage.getItem("sucursalActiva");
        console.log("📦 Sucursal guardada en localStorage:", sucursalGuardada);
        
        // ✅ Actualizar SOLO el ID, no mantener estado duplicado
        if (sucursalGuardada && SUCURSALES_MAP[sucursalGuardada]) {
          const id = SUCURSALES_MAP[sucursalGuardada];
          setSucursalIdActiva(id);
          console.log("✅ ID de sucursal activa:", id);
        } else {
          setSucursalIdActiva(null);
        }
        
        // Al cambiar de sucursal, desactivar modo "Todas las sucursales"
        setVerTodasSucursales(false);
      };

      // Cargar inicial
      actualizarSucursalActiva();

      // Escuchar cambios en localStorage
      window.addEventListener('storage', (e) => {
        if (e.key === 'sucursalActiva') {
          actualizarSucursalActiva();
        }
      });
      
      // Evento personalizado para cuando se cambia desde el sidebar
      const handleSucursalChange = () => actualizarSucursalActiva();
      window.addEventListener('sucursalCambiada', handleSucursalChange);

      return () => {
        window.removeEventListener('storage', actualizarSucursalActiva);
        window.removeEventListener('sucursalCambiada', handleSucursalChange);
      };
    }
  }, [session, status]);

  // Cargar usuarios y sucursales (solo admin)
  useEffect(() => {
    const cargarDatosFiltros = async () => {
      const user = session?.user as any;
      if (user?.role?.toLowerCase() === "admin") {
        try {
          // Cargar usuarios
          const resUsuarios = await fetch("/api/usuarios");
          if (resUsuarios.ok) {
            const dataUsuarios = await resUsuarios.json();
            setUsuarios(dataUsuarios);
          }
          
          // Cargar sucursales
          const resSucursales = await fetch("/api/sucursales");
          if (resSucursales.ok) {
            const dataSucursales = await resSucursales.json();
            setSucursales(dataSucursales);
          }
        } catch (error) {
          console.error("Error cargando datos filtros:", error);
        }
      }
    };
    
    if (status === "authenticated") {
      cargarDatosFiltros();
    }
  }, [status, session]);

  // Contar filtros activos
  useEffect(() => {
    let count = 0;
    Object.entries(filtros).forEach(([key, value]) => {
      if (value && value.trim() !== "") count++;
    });
    setFiltrosActivos(count);
  }, [filtros]);

  // ✅ FUNCIÓN CARGAR VENTAS OPTIMIZADA - SIN DOBLE FUENTE DE VERDAD
  const cargarVentas = useCallback(async (pagina = 1) => {
    if (status !== "authenticated") return;
    
    setIsLoading(true);
    setVentas([]);
    
    try {
      const params = new URLSearchParams({
        pagina: pagina.toString(),
        limite: paginacion.limite.toString(),
        _t: Date.now().toString()
      });

      // Agregar filtros
      Object.entries(filtros).forEach(([key, value]) => {
        if (value && value.trim() !== "") {
          params.append(key, value);
        }
      });

      const user = session?.user as any;
      const isAdmin = user?.role?.toLowerCase() === "admin";
      
      if (isAdmin) {
        // Pasar explícitamente el modo "todas las sucursales"
        params.append('verTodas', verTodasSucursales ? 'true' : 'false');
        
        // ✅ SOLO USAR sucursalIdActiva, sin fallback a sucursalActiva
        if (!verTodasSucursales && sucursalIdActiva) {
          params.append('sucursalId', sucursalIdActiva.toString());
          console.log("🔍 Enviando filtro de sucursal:", sucursalIdActiva);
        }
      } else {
        if (user?.sucursal_id) {
          params.append('sucursalId', user.sucursal_id.toString());
        }
      }

      console.log("📡 Fetching con params:", params.toString());

      const res = await fetch(`/api/historial?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          console.log("✅ Ventas cargadas:", data.ventas.length);
          setVentas(data.ventas);
          setPaginacion(data.paginacion);
        }
      } else {
        console.error("❌ Error en respuesta:", res.status);
      }
    } catch (error) {
      console.error("Error cargando ventas:", error);
    } finally {
      setIsLoading(false);
    }
  }, [status, filtros, paginacion.limite, sucursalIdActiva, verTodasSucursales, session]); // ✅ Sin sucursalActiva

  // ✅ useEffect PROFESIONAL - Espera a tener los datos necesarios
  useEffect(() => {
    if (status !== "authenticated") return;

    const user = session?.user as any;
    const isAdmin = user?.role?.toLowerCase() === "admin";

    // 🔥 Si es admin y NO está en verTodas, esperar hasta que sucursalIdActiva esté lista
    if (isAdmin && !verTodasSucursales && !sucursalIdActiva) {
      console.log("⏳ Esperando sucursal activa...");
      return;
    }

    console.log("🔄 Cargando ventas correctamente...");
    cargarVentas();
  }, [status, sucursalIdActiva, verTodasSucursales, session]); // ✅ SIN cargarVentas en dependencias

  const handleFiltroChange = (nuevosFiltros: Partial<typeof filtros>) => {
    setFiltros(prev => ({ ...prev, ...nuevosFiltros }));
    cargarVentas(1);
  };

  const toggleVerTodasSucursales = () => {
    setVerTodasSucursales(!verTodasSucursales);
    cargarVentas(1);
  };

  const limpiarFiltros = () => {
    setFiltros({
      fechaInicio: "",
      fechaFin: "",
      usuarioId: "",
      metodoPago: "",
      cliente: "",
      sucursalId: ""
    });
    cargarVentas(1);
  };

  const handleExportar = async () => {
    try {
      const params = new URLSearchParams({
        exportar: "true"
      });

      // Agregar filtros solo si tienen valor
      Object.entries(filtros).forEach(([key, value]) => {
        if (value && value.trim() !== "") {
          params.append(key, value);
        }
      });

      // Agregar filtro de sucursal
      const user = session?.user as any;
      const isAdmin = user?.role?.toLowerCase() === "admin";
      
      if (isAdmin) {
        if (!verTodasSucursales && sucursalIdActiva) {
          params.append('sucursalId', sucursalIdActiva.toString());
        }
      } else {
        if (user?.sucursal_id) {
          params.append('sucursalId', user.sucursal_id.toString());
        }
      }

      const res = await fetch(`/api/historial/exportar?${params.toString()}`);
      const blob = await res.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ventas_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error exportando:", error);
      alert("La función de exportación estará disponible pronto");
    }
  };

  const verDetalle = (ventaId: number) => {
    setVentaSeleccionada(ventaId);
    setModalDetalle(true);
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen bg-white items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full border-2 border-gray-200"></div>
            <div className="h-12 w-12 rounded-full border-2 border-gray-900 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-gray-500 font-medium text-sm uppercase tracking-wider">Cargando historial</p>
        </div>
      </div>
    );
  }

  const user = session?.user as any;
  const isAdmin = user?.role?.toLowerCase() === "admin";

  // Obtener nombre de la sucursal actual para mostrar en estadísticas
  const getSucursalActualNombre = () => {
    if (isAdmin) {
      if (verTodasSucursales) return "Todas las sucursales";
      if (sucursalIdActiva) return ID_SUCURSALES_MAP[sucursalIdActiva] || `Sucursal ${sucursalIdActiva}`;
      return "Selecciona una sucursal";
    }
    return user?.sucursal_nombre || "No asignada";
  };

  // Calcular estadísticas
  const totalVentas = isLoading ? 0 : ventas.reduce((sum, venta) => sum + Number(venta.total), 0);
  const promedioVenta = (!isLoading && ventas.length > 0) ? totalVentas / ventas.length : 0;
  const sucursalActual = getSucursalActualNombre();
  const totalProductos = isLoading ? 0 : ventas.reduce((sum, venta) => sum + venta.cantidad_productos, 0);

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      <Sidebar />
      
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8 overflow-hidden">
        
        {/* Header principal */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white rounded-xl border border-gray-200 shadow-sm">
                <Receipt className="text-gray-700" size={24} />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">
                  Historial de Ventas
                </h1>
                <p className="text-xs md:text-sm text-gray-500 mt-1 flex items-center gap-2">
                  <Store size={14} className="text-gray-400" />
                  {isAdmin ? (
                    verTodasSucursales ? (
                      "Mostrando ventas de todas las sucursales"
                    ) : (
                      `Mostrando ventas de: ${sucursalActual}`
                    )
                  ) : (
                    `Tu sucursal: ${sucursalActual}`
                  )}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {/* Botón para alternar entre sucursal activa y todas (solo admin) */}
            {isAdmin && sucursalIdActiva && (
              <button
                onClick={toggleVerTodasSucursales}
                className={`
                  px-3 md:px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-sm md:text-base
                  border ${verTodasSucursales 
                    ? 'bg-gray-900 border-gray-900 text-white' 
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                  }
                `}
              >
                <Globe size={16} className="md:w-4 md:h-4" />
                <span className="hidden sm:inline">
                  {verTodasSucursales ? "Ver solo esta sucursal" : "Ver todas las sucursales"}
                </span>
                <span className="sm:hidden">
                  {verTodasSucursales ? "Esta sucursal" : "Todas"}
                </span>
              </button>
            )}
            
            {/* Botón filtros con contador */}
            <button
              onClick={() => setMostrarFiltros(!mostrarFiltros)}
              className={`
                relative px-3 md:px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-sm md:text-base
                border ${mostrarFiltros 
                  ? 'bg-gray-900 border-gray-900 text-white' 
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                }
              `}
            >
              <Filter size={16} className="md:w-4 md:h-4" />
              <span className="hidden sm:inline">
                {mostrarFiltros ? "Ocultar Filtros" : "Filtros"}
              </span>
              <span className="sm:hidden">Filtros</span>
              {filtrosActivos > 0 && !mostrarFiltros && (
                <span className="absolute -top-1 -right-1 bg-gray-900 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                  {filtrosActivos}
                </span>
              )}
            </button>
            
            <button
              onClick={() => cargarVentas()}
              disabled={isLoading}
              className="p-2 md:px-4 md:py-2 bg-white border border-gray-200 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              <span className="hidden md:inline">Actualizar</span>
            </button>
            
            {isAdmin && (
              <button
                onClick={handleExportar}
                className="px-3 md:px-4 py-2 bg-gray-900 text-white rounded-lg flex items-center gap-2 hover:bg-gray-800 transition-all shadow-sm text-sm md:text-base"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Exportar</span>
              </button>
            )}
            
            <button
              onClick={() => setMostrarEstadisticas(!mostrarEstadisticas)}
              className="p-2 md:hidden bg-white border border-gray-200 rounded-lg flex items-center justify-center"
            >
              <BarChart3 size={16} className="text-gray-700" />
            </button>
          </div>
        </div>

        {/* Estadísticas */}
        {mostrarEstadisticas && (
          <div className="mb-6 animate-in slide-in-from-top-5 duration-300">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {/* Tarjeta 1: Total Vendido */}
              <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                      Total Vendido
                    </p>
                    <p className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900">
                      ${totalVentas.toLocaleString('es-MX')}
                    </p>
                  </div>
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <DollarSign size={18} className="text-gray-700 md:w-5 md:h-5" />
                  </div>
                </div>
                <div className="mt-2 md:mt-3 flex items-center text-[10px] md:text-xs text-gray-500">
                  <span className="font-medium text-gray-900">{ventas.length}</span>
                  <span className="ml-1">{ventas.length === 1 ? 'venta' : 'ventas'}</span>
                </div>
              </div>

              {/* Tarjeta 2: Promedio */}
              <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                      Promedio
                    </p>
                    <p className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900">
                      ${promedioVenta.toLocaleString('es-MX', {minimumFractionDigits: 0})}
                    </p>
                  </div>
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <TrendingUp size={18} className="text-gray-700 md:w-5 md:h-5" />
                  </div>
                </div>
                <div className="mt-2 md:mt-3 flex items-center text-[10px] md:text-xs text-gray-500">
                  <span className="text-gray-600">Por transacción</span>
                </div>
              </div>

              {/* Tarjeta 3: Productos */}
              <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                      Productos
                    </p>
                    <p className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900">
                      {totalProductos}
                    </p>
                  </div>
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Package size={18} className="text-gray-700 md:w-5 md:h-5" />
                  </div>
                </div>
                <div className="mt-2 md:mt-3 flex items-center text-[10px] md:text-xs text-gray-500">
                  <span className="text-gray-600">Unidades vendidas</span>
                </div>
              </div>

              {/* Tarjeta 4: Sucursal */}
              <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow col-span-2 lg:col-span-1">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                      {isAdmin && verTodasSucursales ? "Ámbito" : "Sucursal"}
                    </p>
                    <p className="text-sm md:text-base lg:text-lg font-bold text-gray-900 truncate">
                      {sucursalActual}
                    </p>
                  </div>
                  <div className="p-2 bg-gray-100 rounded-lg flex-shrink-0">
                    {isAdmin && verTodasSucursales ? (
                      <Globe size={18} className="text-gray-700 md:w-5 md:h-5" />
                    ) : (
                      <Store size={18} className="text-gray-700 md:w-5 md:h-5" />
                    )}
                  </div>
                </div>
                <div className="mt-2 md:mt-3 flex items-center text-[10px] md:text-xs text-gray-500">
                  <span className="text-gray-600">
                    {isAdmin 
                      ? verTodasSucursales 
                        ? "Vista global del sistema" 
                        : "Filtrado por sucursal activa"
                      : "Tu ubicación"
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filtros expandibles */}
        {mostrarFiltros && (
          <div className="mb-6 animate-in slide-in-from-top-5 duration-300">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 md:p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-gray-600" />
                  <h3 className="font-bold text-sm text-gray-900 uppercase tracking-wider">
                    Filtros {filtrosActivos > 0 && `(${filtrosActivos})`}
                  </h3>
                </div>
                {filtrosActivos > 0 && (
                  <button
                    onClick={limpiarFiltros}
                    className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded transition-colors"
                  >
                    <X size={12} />
                    Limpiar todo
                  </button>
                )}
              </div>
              <div className="p-4 md:p-5">
                <FiltrosVentas
                  filtros={filtros}
                  onFiltroChange={handleFiltroChange}
                  usuarios={usuarios}
                  sucursales={sucursales}
                  isAdmin={isAdmin}
                  ocultarFiltroSucursal={true}
                  verTodasSucursales={verTodasSucursales}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tabla de ventas */}
        <div className="bg-white rounded-xl md:rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <TablaVentas
            ventas={ventas}
            isLoading={isLoading}
            onVerDetalle={verDetalle}
            paginacion={paginacion}
            onCambiarPagina={cargarVentas}
            isAdmin={isAdmin}
            onRecargar={() => cargarVentas(paginacion.pagina)}
          />
        </div>

        {/* Modal de detalle */}
        <DetalleVentaModal
          ventaId={ventaSeleccionada}
          isOpen={modalDetalle}
          onClose={() => {
            setModalDetalle(false);
            setVentaSeleccionada(null);
          }}
        />
      </main>
    </div>
  );
}