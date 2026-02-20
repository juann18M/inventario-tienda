"use client";

import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { useSession } from "next-auth/react";
import { 
  ShoppingCart, 
  Store, 
  X, 
  Plus, 
  Minus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  LayoutGrid,
  ListFilter,
  Package,
  Calendar,
  User,
  DollarSign,
  Clock,
  Search,
  Receipt,
  History
} from "lucide-react";

interface Producto {
  producto_id: number;
  nombre: string;
  talla?: string | null;
  color?: string | null;
  precio: number;
  stock: number;
  imagen: string | null;
  sku: string;
  categoria: string;
}

interface Sucursal {
  id: number;
  nombre: string;
}

interface CarritoItem {
  producto_id: number;
  nombre: string;
  talla?: string | null;
  color?: string | null;
  precio: number;
  cantidad: number;
  stockDisponible: number;
}

interface Abono {
  id: number;
  monto: number;
  fecha: string;
}

interface Apartado {
  id: number;
  cliente: string;
  total: number;
  anticipo?: number;
  fecha: string;
  estado: string;
  sucursal_id: number;
  sucursal_nombre: string;
  observaciones?: string;
  venta_id?: number | null;
  productos: {
    producto_id: number;
    nombre: string;
    cantidad: number;
    precio: number;
  }[];
  abonos?: Abono[];
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning';
}

export default function ApartadosPage() {
  const { data: session, status } = useSession();
  const user = session?.user as any;
  const rol = String(user?.role || "").toLowerCase();
  const sucursalUsuario = user?.sucursal;

  // Estados de Datos
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState<number>(1);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [apartados, setApartados] = useState<Apartado[]>([]);
  
  // Estados de Interfaz
  const [cliente, setCliente] = useState("");
  const [anticipo, setAnticipo] = useState<number | string>("");
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [verApartados, setVerApartados] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaApartados, setBusquedaApartados] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Estados para modales
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<{open: boolean, id: number | null}>({open: false, id: null});
  const [isAbonoModalOpen, setIsAbonoModalOpen] = useState(false);
  const [isDeletePermanentModalOpen, setIsDeletePermanentModalOpen] = useState<{open: boolean, id: number | null}>({open: false, id: null});
  const [isDeleteVentaModalOpen, setIsDeleteVentaModalOpen] = useState<{open: boolean, id: number | null}>({open: false, id: null});
  const [isDeleteLiquidadoModalOpen, setIsDeleteLiquidadoModalOpen] = useState<{open: boolean, id: number | null, cliente: string}>({open: false, id: null, cliente: ""});
  const [apartadoSeleccionado, setApartadoSeleccionado] = useState<Apartado | null>(null);
  const [montoAbono, setMontoAbono] = useState<number | string>("");

  // --- SISTEMA DE NOTIFICACIONES (TOASTS) ---
  const addToast = (message: string, type: 'success' | 'error' | 'warning') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // --- FILTRADO ---
  const productosFiltrados = productos.filter(p => 
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || 
    p.sku?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.categoria?.toLowerCase().includes(busqueda.toLowerCase())
  );

  // --- FUNCIÓN PARA ELIMINAR ABONO ---
  async function eliminarAbono(abonoId: number, apartadoId: number, monto: number) {
    if (!confirm("¿Estás seguro de eliminar este abono?")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/abonos/${abonoId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok) {
        addToast("Abono eliminado correctamente", "success");

        // Actualizar estado local sin recargar todo
        setApartados(prev =>
          prev.map(a =>
            a.id === apartadoId
              ? {
                  ...a,
                  abonos: a.abonos?.filter(ab => ab.id !== abonoId),
                  anticipo: Number(((a.anticipo || 0) - monto).toFixed(2)),
                  // Si el anticipo ahora es menor al total, vuelve a pendiente
                  estado: Number(((a.anticipo || 0) - monto).toFixed(2)) >= a.total 
                    ? 'completado' 
                    : 'pendiente'
                }
              : a
          )
        );

        // Refrescar los apartados para asegurar consistencia
        fetchApartados();
      } else {
        addToast(data.error || "Error al eliminar abono", "error");
      }
    } catch (error) {
      addToast("Error al eliminar abono", "error");
    } finally {
      setLoading(false);
    }
  }

  // --- FUNCIÓN PARA ELIMINAR APARTADO LIQUIDADO ---
  async function eliminarApartadoLiquidado(apartadoId: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/apartados/${apartadoId}?deleteLiquidado=true`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok) {
        addToast(data.message || "Apartado liquidado eliminado permanentemente", "success");
        setIsDeleteLiquidadoModalOpen({ open: false, id: null, cliente: "" });
        
        // Eliminar del estado local
        setApartados(prevApartados => 
          prevApartados.filter(a => a.id !== apartadoId)
        );
      } else {
        addToast(data.error || "Error al eliminar el apartado", "error");
      }
    } catch (error) {
      addToast("Error al eliminar el apartado", "error");
    } finally {
      setLoading(false);
    }
  }

  // Cargar sucursales al inicio
  useEffect(() => {
    fetchSucursales();
  }, []);

  // Cargar productos cuando cambia la sucursal
  useEffect(() => {
    if (sucursalSeleccionada) {
      fetchProductos();
    }
  }, [sucursalSeleccionada]);

  async function fetchSucursales() {
    try {
      const res = await fetch("/api/sucursales");
      const data = await res.json();
      setSucursales(data);
      if (data.length > 0) {
        if (rol !== "admin" && sucursalUsuario) {
          const sucursal = data.find((s: Sucursal) => s.nombre === sucursalUsuario);
          setSucursalSeleccionada(sucursal?.id || data[0].id);
        } else {
          const guardada = localStorage.getItem("sucursalActivaApartados");
          setSucursalSeleccionada(guardada ? Number(guardada) : data[0].id);
        }
      }
    } catch (error) {
      console.error("Error al cargar sucursales:", error);
      addToast("Error al cargar sucursales", "error");
    }
  }

  async function fetchProductos() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/productos-por-sucursal?sucursalId=${sucursalSeleccionada}`);
      const data = await res.json();
      setProductos(data);
    } catch (error) {
      console.error("Error al cargar productos:", error);
      addToast("Error al cargar productos", "error");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchApartados() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/apartados");
      const data = await res.json();
      setApartados(data);
    } catch (error) {
      console.error("Error al cargar apartados:", error);
      addToast("Error al cargar apartados", "error");
    } finally {
      setIsLoading(false);
    }
  }

  function agregarAlCarrito(producto: Producto, cantidad: number) {
    const existente = carrito.find(item => item.producto_id === producto.producto_id);
    
    if (existente) {
      const nuevaCantidad = existente.cantidad + cantidad;
      if (nuevaCantidad > producto.stock) {
        addToast(`Solo hay ${producto.stock} unidades disponibles`, "warning");
        return;
      }
      setCarrito(carrito.map(item => 
        item.producto_id === producto.producto_id 
          ? { ...item, cantidad: nuevaCantidad }
          : item
      ));
    } else {
      if (cantidad > producto.stock) {
        addToast(`Solo hay ${producto.stock} unidades disponibles`, "warning");
        return;
      }
      setCarrito([...carrito, {
        producto_id: producto.producto_id,
        nombre: producto.nombre,
        talla: producto.talla,
        color: producto.color,
        precio: producto.precio,
        cantidad,
        stockDisponible: producto.stock
      }]);
    }
    addToast("Producto agregado al apartado", "success");
  }

  function quitarDelCarrito(producto_id: number) {
    setCarrito(carrito.filter(item => item.producto_id !== producto_id));
    addToast("Producto eliminado del apartado", "success");
  }

  function actualizarCantidad(producto_id: number, nuevaCantidad: number) {
    const producto = productos.find(v => v.producto_id === producto_id);
    if (!producto) return;
    
    if (nuevaCantidad > producto.stock) {
      addToast(`Solo hay ${producto.stock} unidades disponibles`, "warning");
      return;
    }
    
    if (nuevaCantidad < 1) {
      quitarDelCarrito(producto_id);
      return;
    }
    
    setCarrito(carrito.map(item => 
      item.producto_id === producto_id ? { ...item, cantidad: nuevaCantidad } : item
    ));
  }

  async function crearApartado() {
    if (!cliente.trim()) {
      addToast("El nombre del cliente es requerido", "error");
      return;
    }

    if (carrito.length === 0) {
      addToast("Agrega al menos un producto", "error");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/apartados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente,
          sucursal_id: sucursalSeleccionada,
          anticipo: anticipo === "" ? 0 : Number(anticipo),
          observaciones,
          productos: carrito.map(item => ({
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            precio: item.precio,
            nombre: item.nombre
          }))
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al crear apartado");
      }

      addToast("¡Apartado creado exitosamente!", "success");
      setCliente("");
      setAnticipo("");
      setObservaciones("");
      setCarrito([]);
      fetchProductos();
      
    } catch (error: any) {
      addToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function cancelarApartado() {
    if (!isCancelModalOpen.id) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/apartados/${isCancelModalOpen.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok) {
        addToast(data.message || "Apartado cancelado y stock devuelto", "success");
        setIsCancelModalOpen({ open: false, id: null });
        
        // Actualizar estado local
        setApartados(prevApartados => 
          prevApartados.map(a => 
            a.id === isCancelModalOpen.id 
              ? { ...a, estado: 'cancelado' }
              : a
          )
        );
        fetchApartados();
      } else {
        addToast(data.error || "Error al cancelar el apartado", "error");
      }
    } catch (error) {
      addToast("Error al cancelar el apartado", "error");
    } finally {
      setLoading(false);
    }
  }

  async function registrarAbono() {
    if (!apartadoSeleccionado) return;
    
    const montoNumerico = montoAbono === "" ? 0 : Number(montoAbono);
    
    if (montoNumerico <= 0) {
      addToast("El monto debe ser mayor a 0", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/apartados/${apartadoSeleccionado.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          monto: montoNumerico,
          liquidador: false
        }),
      });

      const data = await res.json();

      if (res.ok) {
        addToast(data.message, "success");
        
        // Actualizar estado local
        const nuevoAnticipo = (apartadoSeleccionado.anticipo || 0) + montoNumerico;
        const nuevoEstado = nuevoAnticipo >= apartadoSeleccionado.total ? 'completado' : 'pendiente';
        
        setApartados(prevApartados => 
          prevApartados.map(a => 
            a.id === apartadoSeleccionado.id 
              ? { 
                  ...a, 
                  anticipo: nuevoAnticipo,
                  estado: nuevoEstado,
                  venta_id: data.venta_id || a.venta_id
                }
              : a
          )
        );

        setIsAbonoModalOpen(false);
        setMontoAbono("");
        setApartadoSeleccionado(null);
        
        // Refrescar para obtener el nuevo abono con ID
        fetchApartados();
        
        if (data.venta_creada) {
          addToast("¡Apartado liquidado y registrado en ventas!", "success");
        }
      } else {
        addToast(data.error, "error");
      }
    } catch (error) {
      addToast("Error al registrar abono", "error");
    } finally {
      setLoading(false);
    }
  }

  async function liquidarApartado(apartado: Apartado) {
    setLoading(true);
    try {
      const res = await fetch(`/api/apartados/${apartado.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          monto: 0,
          liquidador: true
        }),
      });

      const data = await res.json();

      if (res.ok) {
        addToast(data.message, "success");
        
        // Actualizar estado local
        setApartados(prevApartados => 
          prevApartados.map(a => 
            a.id === apartado.id 
              ? { 
                  ...a, 
                  estado: 'completado', 
                  anticipo: a.total,
                  venta_id: data.venta_id 
                }
              : a
          )
        );
        
        fetchApartados();
      } else {
        addToast(data.error, "error");
      }
    } catch (error) {
      addToast("Error al liquidar apartado", "error");
    } finally {
      setLoading(false);
    }
  }

  async function eliminarPermanentemente() {
    if (!isDeletePermanentModalOpen.id) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/apartados/${isDeletePermanentModalOpen.id}?force=true`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok) {
        addToast(data.message || "Apartado eliminado permanentemente", "success");
        setIsDeletePermanentModalOpen({ open: false, id: null });
        
        // Eliminar del estado local
        setApartados(prevApartados => 
          prevApartados.filter(a => a.id !== isDeletePermanentModalOpen.id)
        );
      } else {
        addToast(data.error || "Error al eliminar el apartado", "error");
      }
    } catch (error) {
      addToast("Error al eliminar el apartado", "error");
    } finally {
      setLoading(false);
    }
  }

  async function eliminarVentaDelHistorial(apartadoId: number, ventaId: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/apartados/${apartadoId}?deleteVenta=true`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok) {
        addToast(data.message || "Venta eliminada del historial", "success");
        setIsDeleteVentaModalOpen({ open: false, id: null });
        
        // Actualizar estado local
        setApartados(prevApartados => 
          prevApartados.map(a => 
            a.id === apartadoId 
              ? { ...a, venta_id: null }
              : a
          )
        );
      } else {
        addToast(data.error || "Error al eliminar la venta", "error");
      }
    } catch (error) {
      addToast("Error al eliminar la venta", "error");
    } finally {
      setLoading(false);
    }
  }

  const handleCambioSucursal = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevaSuc = Number(e.target.value);
    setSucursalSeleccionada(nuevaSuc);
    setCarrito([]);
    if (rol === "admin") {
      localStorage.setItem("sucursalActivaApartados", nuevaSuc.toString());
    }
  };

  // Manejar cambio en anticipo
  const handleAnticipoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Permitir solo números y punto decimal
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAnticipo(value);
    }
  };

  // Manejar cambio en monto de abono
  const handleMontoAbonoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Permitir solo números y punto decimal
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setMontoAbono(value);
    }
  };

  // Manejar blur del anticipo
  const handleAnticipoBlur = () => {
    if (anticipo === "" || Number(anticipo) < 0) {
      setAnticipo("");
    } else if (Number(anticipo) > totalCarrito) {
      setAnticipo(totalCarrito.toString());
    }
  };

  // Manejar blur del monto de abono
  const handleMontoAbonoBlur = () => {
    if (!apartadoSeleccionado) return;
    const maxMonto = apartadoSeleccionado.total - (apartadoSeleccionado.anticipo || 0);
    
    if (montoAbono === "" || Number(montoAbono) < 0) {
      setMontoAbono("");
    } else if (Number(montoAbono) > maxMonto) {
      setMontoAbono(maxMonto.toString());
    }
  };

  const totalCarrito = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  const saldoPendiente = totalCarrito - (anticipo === "" ? 0 : Number(anticipo));

  if (status === "loading") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-black" />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500 animate-pulse">Cargando Sistema de Apartados...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      <Sidebar onCerrarSesion={() => {}} />

      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 md:p-8 lg:p-12 overflow-hidden">
        
        {/* ENCABEZADO */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-gray-900">Apartados</h1>
            <p className="text-sm font-medium text-gray-500 mt-1 flex items-center gap-2">
              <Store size={14} />
              Gestión de apartados y reservaciones
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Badge Sucursal */}
            <div className={`px-5 py-2.5 rounded-xl border flex flex-col justify-center transition-all ${rol === 'admin' ? 'bg-white border-blue-200 shadow-sm' : 'bg-white border-gray-200'}`}>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                {rol === "admin" ? "Vista de Admin" : "Tu Sucursal"}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-800 uppercase leading-none">
                  {sucursales.find(s => s.id === sucursalSeleccionada)?.nombre || "Seleccione..."}
                </span>
                {rol === "admin" && <CheckCircle2 size={14} className="text-blue-500" />}
              </div>
            </div>

            {/* Pestañas */}
            <div className="flex gap-2">
              <button
                onClick={() => setVerApartados(false)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${
                  !verApartados 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Package size={16} />
                Apartar
              </button>
              <button
                onClick={() => {
                  setVerApartados(true);
                  fetchApartados();
                }}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${
                  verApartados 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Calendar size={16} />
                Ver Apartados
              </button>
            </div>
          </div>
        </header>

        {verApartados ? (
          /* SECCIÓN DE APARTADOS CREADOS */
          <div>
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar apartado por cliente..."
                  className="w-full bg-gray-50 border-none rounded-xl pl-12 pr-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-black/5 transition-all"
                  value={busquedaApartados}
                  onChange={(e) => setBusquedaApartados(e.target.value)}
                />
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1,2,3].map((i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6 animate-pulse">
                    <div className="h-6 bg-gray-100 rounded w-3/4 mb-4"></div>
                    <div className="h-4 bg-gray-100 rounded w-1/2 mb-2"></div>
                    <div className="h-4 bg-gray-100 rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : apartados.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-200 p-16 text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Calendar size={32} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-black uppercase text-gray-900 mb-2">No hay apartados</h3>
                <p className="text-sm text-gray-500">Los apartados que crees aparecerán aquí</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {apartados
                  .filter(a => a.cliente.toLowerCase().includes(busquedaApartados.toLowerCase()))
                  .map((apartado) => {
                    const saldo = apartado.total - (apartado.anticipo || 0);
                    const tieneAbonos = apartado.abonos && apartado.abonos.length > 0;
                    return (
                      <div key={apartado.id} className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-all">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-black text-gray-900 uppercase">{apartado.cliente}</h3>
                            <p className="text-xs text-gray-500 mt-1">ID: {apartado.id}</p>
                            {apartado.venta_id && (
                              <p className="text-[10px] text-blue-600 mt-1 flex items-center gap-1">
                                <Receipt size={12} />
                                Venta #{apartado.venta_id}
                              </p>
                            )}
                          </div>
                          <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            apartado.estado === 'pendiente' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                            apartado.estado === 'completado' ? 'bg-green-50 text-green-700 border border-green-200' :
                            'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {apartado.estado === 'pendiente' ? 'Pendiente' : 
                             apartado.estado === 'completado' ? 'Liquidado' : 'Cancelado'}
                          </span>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <p className="text-xs flex items-center gap-2 text-gray-600">
                            <Store size={14} className="text-gray-400" />
                            {apartado.sucursal_nombre}
                          </p>
                          <p className="text-xs flex items-center gap-2 text-gray-600">
                            <Clock size={14} className="text-gray-400" />
                            {new Date(apartado.fecha).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="border-t border-gray-100 pt-4 mb-4">
                          <p className="text-xs font-bold uppercase text-gray-400 mb-2">Productos</p>
                          <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                            {apartado.productos.map((p, i) => (
                              <div key={i} className="flex justify-between items-center text-xs">
                                <span className="text-gray-600">{p.nombre}</span>
                                <span className="font-bold text-gray-900">x{p.cantidad}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Historial de Abonos con botón de eliminar */}
                        {tieneAbonos && (
                          <div className="border-t border-gray-100 pt-3 mb-4">
                            <p className="text-[10px] font-bold uppercase text-gray-400 mb-2 flex items-center gap-1">
                              <History size={12} />
                              Abonos realizados
                            </p>
                            <div className="space-y-2 max-h-20 overflow-y-auto custom-scrollbar">
                              {apartado.abonos?.map((abono) => (
                                <div key={abono.id} className="flex justify-between items-center text-[10px] group hover:bg-gray-50 p-1 rounded transition-colors">
                                  <span className="text-gray-500">
                                    {new Date(abono.fecha).toLocaleDateString()}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-green-600">+${abono.monto}</span>
                                    
                                    {/* Botón de eliminar abono - Solo visible para admin */}
                                    {rol === "admin" && (
                                      <button
                                        onClick={() => eliminarAbono(abono.id, apartado.id, abono.monto)}
                                        disabled={loading}
                                        className="opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-red-100 rounded-full"
                                        title="Eliminar abono"
                                      >
                                        <Trash2 size={12} className="text-red-500" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-2 mb-4">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold uppercase text-gray-400">Total</span>
                            <span className="text-lg font-black text-gray-900">${apartado.total}</span>
                          </div>
                          {apartado.anticipo ? (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-500">Pagado:</span>
                              <span className="font-bold text-green-600">${apartado.anticipo}</span>
                            </div>
                          ) : null}
                          {apartado.estado === 'pendiente' && (
                            <div className="flex justify-between items-center text-sm pt-1 border-t border-gray-100">
                              <span className="font-bold text-gray-700">Saldo:</span>
                              <span className="font-black text-red-600">${saldo.toFixed(2)}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2">
                          {apartado.estado === 'pendiente' && (
                            <>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setApartadoSeleccionado(apartado);
                                    setMontoAbono(saldo.toString());
                                    setIsAbonoModalOpen(true);
                                  }}
                                  className="flex-1 py-3 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                                >
                                  <DollarSign size={14} />
                                  Abonar
                                </button>
                                <button
                                  onClick={() => liquidarApartado(apartado)}
                                  className="flex-1 py-3 bg-green-50 text-green-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-green-100 transition-all flex items-center justify-center gap-2"
                                >
                                  <CheckCircle2 size={14} />
                                  Liquidar
                                </button>
                              </div>
                              <button
                                onClick={() => setIsCancelModalOpen({open: true, id: apartado.id})}
                                className="w-full py-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                              >
                                <Trash2 size={14} />
                                Cancelar Apartado
                              </button>
                            </>
                          )}
                          
                          {apartado.estado === 'cancelado' && (
                            <button
                              onClick={() => setIsDeletePermanentModalOpen({open: true, id: apartado.id})}
                              className="w-full py-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                            >
                              <Trash2 size={14} />
                              Eliminar Permanentemente
                            </button>
                          )}

                          {apartado.estado === 'completado' && (
                            <div className="flex flex-col gap-2">
                              <div className="w-full py-3 bg-green-50 text-green-600 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                                <CheckCircle2 size={14} />
                                Venta Registrada
                              </div>
                              
                              {/* BOTÓN PARA ELIMINAR APARTADO LIQUIDADO COMPLETAMENTE */}
                              {rol === "admin" && (
                                <button
                                  onClick={() => setIsDeleteLiquidadoModalOpen({
                                    open: true, 
                                    id: apartado.id, 
                                    cliente: apartado.cliente
                                  })}
                                  className="w-full py-3 bg-red-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-lg"
                                >
                                  <Trash2 size={14} />
                                  Eliminar Apartado Liquidado
                                </button>
                              )}
                              
                              {/* Botón para solo eliminar la venta del historial */}
                              {apartado.venta_id && (
                                <button
                                  onClick={() => setIsDeleteVentaModalOpen({open: true, id: apartado.id})}
                                  className="w-full py-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                                >
                                  <Receipt size={14} />
                                  Solo eliminar venta del historial
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        ) : (
          /* SECCIÓN DE APARTAR PRODUCTOS */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Columna izquierda: Productos */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h2 className="text-lg font-black uppercase text-gray-900 flex items-center gap-2">
                      <Package size={20} />
                      Productos Disponibles
                    </h2>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      {rol === "admin" && (
                        <div className="relative flex-1 md:min-w-[200px]">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <ListFilter size={18} className="text-gray-400"/>
                          </div>
                          <select 
                            className="w-full appearance-none bg-gray-50 border-none rounded-xl pl-12 pr-10 py-3 text-sm font-bold text-gray-700 uppercase outline-none focus:ring-2 focus:ring-black/5 cursor-pointer"
                            value={sucursalSeleccionada}
                            onChange={handleCambioSucursal}
                          >
                            {sucursales.map((s) => (
                              <option key={s.id} value={s.id}>{s.nombre}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      
                      <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                          type="text" 
                          placeholder="Buscar producto..."
                          className="w-full bg-gray-50 border-none rounded-xl pl-12 pr-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-black/5"
                          value={busqueda}
                          onChange={(e) => setBusqueda(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                      <AlertCircle size={18} className="text-red-500" />
                      <p className="text-xs font-bold text-red-700 uppercase tracking-wider">{error}</p>
                    </div>
                  )}

                  {success && (
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                      <CheckCircle2 size={18} className="text-green-500" />
                      <p className="text-xs font-bold text-green-700 uppercase tracking-wider">{success}</p>
                    </div>
                  )}

                  {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[1,2,3,4].map((i) => (
                        <div key={i} className="border border-gray-100 rounded-xl p-4 animate-pulse">
                          <div className="flex gap-3">
                            <div className="w-20 h-20 bg-gray-100 rounded-lg"></div>
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                              <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : productosFiltrados.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Package size={24} className="text-gray-400" />
                      </div>
                      <p className="text-sm font-bold uppercase text-gray-500">No hay productos disponibles</p>
                      <p className="text-xs text-gray-400 mt-1">En esta sucursal no hay productos con stock</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
                      {productosFiltrados.map((producto) => (
                        <div key={producto.producto_id} className="border border-gray-100 rounded-xl p-4 hover:border-gray-300 hover:shadow-md transition-all">
                          <div className="flex gap-3">
                            <div className="w-20 h-20 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100">
                              {producto.imagen ? (
                                <img src={producto.imagen} alt={producto.nombre} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                  <Package size={24} />
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold text-sm text-gray-900 uppercase mb-1">{producto.nombre}</h3>
                              <p className="text-[10px] font-mono text-gray-500 mb-1">SKU: {producto.sku}</p>
                              <div className="flex flex-wrap gap-1 mb-1">
                                {producto.talla && (
                                  <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded font-bold uppercase">
                                    T: {producto.talla}
                                  </span>
                                )}
                                {producto.color && (
                                  <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded font-bold uppercase">
                                    C: {producto.color}
                                  </span>
                                )}
                              </div>
                              <div className="flex justify-between items-center mt-1">
                                <span className="text-sm font-black text-gray-900">${producto.precio}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  producto.stock <= 2 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                                }`}>
                                  Stock: {producto.stock}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-3 flex gap-2">
                            <input
                              type="number"
                              min="1"
                              max={producto.stock}
                              defaultValue="1"
                              id={`cantidad-${producto.producto_id}`}
                              className="w-16 border border-gray-200 rounded-lg p-2 text-center text-sm font-bold focus:border-black focus:ring-0"
                              onKeyDown={(e) => {
                                if (e.key === '-' || e.key === 'e') {
                                  e.preventDefault();
                                }
                              }}
                            />
                            <button
                              onClick={() => {
                                const input = document.getElementById(`cantidad-${producto.producto_id}`) as HTMLInputElement;
                                const cantidad = parseInt(input.value);
                                if (cantidad > 0 && cantidad <= producto.stock) {
                                  agregarAlCarrito(producto, cantidad);
                                  input.value = "1";
                                }
                              }}
                              disabled={producto.stock === 0}
                              className="flex-1 bg-black text-white px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                              <Plus size={14} />
                              Apartar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Columna derecha: Carrito */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm sticky top-6">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-lg font-black uppercase text-gray-900 flex items-center gap-2">
                    <ShoppingCart size={20} />
                    Apartado Actual
                  </h2>
                </div>
                
                <div className="p-6">
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1 ml-1">
                        Cliente <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type="text"
                          value={cliente}
                          onChange={(e) => setCliente(e.target.value)}
                          placeholder="Nombre del cliente"
                          className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-black/5"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1 ml-1">
                        Anticipo $
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={anticipo}
                          onChange={handleAnticipoChange}
                          onBlur={handleAnticipoBlur}
                          placeholder="0"
                          className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-black/5"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1 ml-1">
                        Observaciones
                      </label>
                      <textarea
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        placeholder="Notas adicionales..."
                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-black/5 resize-none"
                        rows={2}
                      />
                    </div>
                  </div>

                  {carrito.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <ShoppingCart size={20} className="text-gray-400" />
                      </div>
                      <p className="text-xs font-bold uppercase text-gray-500">Carrito vacío</p>
                      <p className="text-[10px] text-gray-400 mt-1">Agrega productos para crear un apartado</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 mb-6 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                        {carrito.map((item) => (
                          <div key={item.producto_id} className="bg-gray-50 rounded-xl p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-bold text-xs text-gray-900 uppercase">{item.nombre}</p>
                                <p className="text-[9px] text-gray-500 mt-0.5">
                                  {item.talla && `Talla: ${item.talla} `}
                                  {item.color && `Color: ${item.color}`}
                                </p>
                              </div>
                              <button
                                onClick={() => quitarDelCarrito(item.producto_id)}
                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-gray-900">${item.precio}</span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => actualizarCantidad(item.producto_id, item.cantidad - 1)}
                                  className="p-1 bg-white border border-gray-200 rounded-lg hover:border-gray-400 transition-colors"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="w-8 text-center text-sm font-bold">{item.cantidad}</span>
                                <button
                                  onClick={() => actualizarCantidad(item.producto_id, item.cantidad + 1)}
                                  className="p-1 bg-white border border-gray-200 rounded-lg hover:border-gray-400 transition-colors"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-gray-100 pt-4 mb-6">
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Subtotal:</span>
                            <span className="font-bold text-gray-900">${totalCarrito.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Anticipo:</span>
                            <span className="font-bold text-green-600">
                              -${anticipo === "" ? "0.00" : Number(anticipo).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-base pt-2 border-t border-gray-100">
                            <span className="font-black uppercase text-gray-700">Saldo:</span>
                            <span className="font-black text-gray-900">${saldoPendiente.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={crearApartado}
                        disabled={loading || !cliente}
                        className="w-full bg-black text-white py-4 rounded-xl text-xs font-bold uppercase tracking-[0.2em] shadow-xl hover:bg-gray-900 hover:scale-[1.01] transition-all active:scale-[0.99] disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        {loading ? (
                          <Loader2 size={16} className="animate-spin mx-auto" />
                        ) : (
                          "Confirmar Apartado"
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- NOTIFICACIONES (TOASTS) --- */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div 
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl animate-in slide-in-from-right-10 fade-in duration-300 max-w-sm border-l-4 ${
              toast.type === 'success' ? 'bg-white border-emerald-500 text-gray-800' : 
              toast.type === 'error' ? 'bg-white border-red-500 text-gray-800' : 
              'bg-white border-amber-500 text-gray-800'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 size={20} className="text-emerald-500" />}
            {toast.type === 'error' && <AlertCircle size={20} className="text-red-500" />}
            {toast.type === 'warning' && <AlertTriangle size={20} className="text-amber-500" />}
            <p className="text-xs font-bold uppercase tracking-wide">{toast.message}</p>
          </div>
        ))}
      </div>

      {/* --- MODAL CANCELAR APARTADO --- */}
      {isCancelModalOpen.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsCancelModalOpen({open: false, id: null})}></div>
          <div className="relative bg-white p-8 rounded-[2rem] max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h2 className="text-xl font-black uppercase text-gray-900">¿Cancelar apartado?</h2>
            <p className="text-sm text-gray-500 mt-2 mb-8">
              Se devolverá el stock a la sucursal y el apartado quedará como cancelado.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setIsCancelModalOpen({open: false, id: null})} 
                className="py-3 bg-gray-100 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-500 hover:bg-gray-200 transition-colors"
              >
                No, volver
              </button>
              <button 
                onClick={cancelarApartado} 
                disabled={loading}
                className="py-3 bg-red-500 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-red-600 transition-colors disabled:bg-red-300 disabled:cursor-not-allowed"
              >
                {loading ? "Cancelando..." : "Sí, cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE ABONOS --- */}
      {isAbonoModalOpen && apartadoSeleccionado && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => {
            setIsAbonoModalOpen(false);
            setApartadoSeleccionado(null);
            setMontoAbono("");
          }}></div>
          <div className="relative bg-white p-8 rounded-[2rem] max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <DollarSign size={32} />
            </div>
            
            <h2 className="text-xl font-black uppercase text-gray-900 text-center mb-2">
              Registrar Abono
            </h2>
            
            <p className="text-sm text-gray-500 text-center mb-6">
              Cliente: <span className="font-bold text-gray-900">{apartadoSeleccionado.cliente}</span>
            </p>

            <div className="space-y-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-xl">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Total apartado:</span>
                  <span className="font-bold">${apartadoSeleccionado.total}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Pagado:</span>
                  <span className="font-bold text-green-600">${apartadoSeleccionado.anticipo || 0}</span>
                </div>
                <div className="flex justify-between text-base pt-2 border-t border-gray-200">
                  <span className="font-bold text-gray-700">Saldo pendiente:</span>
                  <span className="font-black text-red-600">
                    ${(apartadoSeleccionado.total - (apartadoSeleccionado.anticipo || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1 ml-1">
                  Monto a abonar $
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={montoAbono}
                    onChange={handleMontoAbonoChange}
                    onBlur={handleMontoAbonoBlur}
                    placeholder="0"
                    className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-black/5"
                    autoFocus
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => {
                  setIsAbonoModalOpen(false);
                  setApartadoSeleccionado(null);
                  setMontoAbono("");
                }} 
                className="py-3 bg-gray-100 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-500 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={registrarAbono} 
                disabled={loading || montoAbono === "" || Number(montoAbono) <= 0}
                className="py-3 bg-blue-600 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
              >
                {loading ? "Procesando..." : "Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL ELIMINAR PERMANENTEMENTE (APARTADOS CANCELADOS) --- */}
      {isDeletePermanentModalOpen.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsDeletePermanentModalOpen({open: false, id: null})}></div>
          <div className="relative bg-white p-8 rounded-[2rem] max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h2 className="text-xl font-black uppercase text-gray-900">¿Eliminar permanentemente?</h2>
            <p className="text-sm text-gray-500 mt-2 mb-8">
              Esta acción eliminará el apartado cancelado de la base de datos. 
              <span className="font-bold block mt-2 text-red-500">¡No se puede deshacer!</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setIsDeletePermanentModalOpen({open: false, id: null})} 
                className="py-3 bg-gray-100 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-500 hover:bg-gray-200 transition-colors"
              >
                No, volver
              </button>
              <button 
                onClick={eliminarPermanentemente} 
                disabled={loading}
                className="py-3 bg-red-600 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-red-700 transition-colors disabled:bg-red-300"
              >
                {loading ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL ELIMINAR APARTADO LIQUIDADO --- */}
      {isDeleteLiquidadoModalOpen.open && isDeleteLiquidadoModalOpen.id && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsDeleteLiquidadoModalOpen({open: false, id: null, cliente: ""})}></div>
          <div className="relative bg-white p-8 rounded-[2rem] max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-600 text-white rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h2 className="text-xl font-black uppercase text-gray-900">¿Eliminar Apartado Liquidado?</h2>
            <p className="text-sm text-gray-500 mt-2 mb-4">
              Estás a punto de eliminar permanentemente el apartado de <span className="font-bold text-gray-900">{isDeleteLiquidadoModalOpen.cliente}</span>.
            </p>
            <p className="text-xs bg-red-50 p-3 rounded-xl text-red-700 font-bold mb-6">
              Esta acción eliminará TODOS los abonos, productos y la venta asociada. 
              <span className="block mt-1 text-red-600">¡NO SE PUEDE DESHACER!</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setIsDeleteLiquidadoModalOpen({open: false, id: null, cliente: ""})} 
                className="py-3 bg-gray-100 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-500 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => eliminarApartadoLiquidado(isDeleteLiquidadoModalOpen.id!)} 
                disabled={loading}
                className="py-3 bg-red-600 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-red-700 transition-colors disabled:bg-red-300"
              >
                {loading ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL ELIMINAR VENTA DEL HISTORIAL --- */}
      {isDeleteVentaModalOpen.open && isDeleteVentaModalOpen.id && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsDeleteVentaModalOpen({open: false, id: null})}></div>
          <div className="relative bg-white p-8 rounded-[2rem] max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Receipt size={32} />
            </div>
            <h2 className="text-xl font-black uppercase text-gray-900">¿Eliminar del historial?</h2>
            <p className="text-sm text-gray-500 mt-2 mb-8">
              Esta acción eliminará la venta del historial, pero el apartado seguirá como completado.
              <span className="font-bold block mt-2 text-red-500">¡No se puede deshacer!</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setIsDeleteVentaModalOpen({open: false, id: null})} 
                className="py-3 bg-gray-100 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-500 hover:bg-gray-200 transition-colors"
              >
                No, volver
              </button>
              <button 
                onClick={() => {
                  const apartado = apartados.find(a => a.id === isDeleteVentaModalOpen.id);
                  if (apartado?.venta_id) {
                    eliminarVentaDelHistorial(apartado.id, apartado.venta_id);
                  }
                }} 
                disabled={loading}
                className="py-3 bg-red-600 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-red-700 transition-colors disabled:bg-red-300"
              >
                {loading ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}