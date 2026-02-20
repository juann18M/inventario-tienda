"use client";

import Sidebar from "../components/Sidebar";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { 
  Search, 
  Store, 
  ArrowRight, 
  Package, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  X,
  Plus,
  Minus,
  Trash2,
  History,
  Calendar,
  User,
  Clock
} from "lucide-react";

interface Producto {
  id: number;
  nombre: string;
  sku: string;
  talla?: string | null;
  color?: string | null;
  stock: number;
  precio: number;
  imagen: string | null;
  sucursal: string;
}

interface Sucursal {
  id: number;
  nombre: string;
}

interface ProductoTraslado {
  producto_id: number;
  cantidad: number;
  nombre: string;
  sku: string;
  talla?: string | null;
  color?: string | null;
  stock: number;
  precio: number;
  imagen: string | null;
}

interface Traslado {
  id: number;
  fecha: string;
  sucursal_origen: string;
  sucursal_destino: string;
  usuario_nombre: string;
  estado: string;
  observacion: string;
  total_productos: number;
  total_cantidad: number;
  detalles: {
    id: number;
    id_producto: number;
    cantidad: number;
    producto_nombre: string;
    producto_sku: string;
    producto_talla: string | null;
    producto_color: string | null;
    producto_precio: number;
    producto_imagen: string | null;
  }[];
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning';
}

export default function TrasladoPage() {
  const { data: session, status } = useSession();
  const user = session?.user as any;
  const rol = String(user?.role || "").toLowerCase();
  const sucursalUsuario = user?.sucursal;

  // Estados
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [listaTraslado, setListaTraslado] = useState<ProductoTraslado[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProductos, setIsLoadingProductos] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showProductos, setShowProductos] = useState(false);
  const [observacion, setObservacion] = useState("");
  
  // Estados para historial
  const [verHistorial, setVerHistorial] = useState(false);
  const [traslados, setTraslados] = useState<Traslado[]>([]);
  const [isLoadingHistorial, setIsLoadingHistorial] = useState(false);
  const [trasladoSeleccionado, setTrasladoSeleccionado] = useState<Traslado | null>(null);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  
  // Estados para eliminar traslado
  const [trasladoAEliminar, setTrasladoAEliminar] = useState<number | null>(null);
  const [eliminando, setEliminando] = useState(false);

  // Cargar sucursales
  useEffect(() => {
    const fetchSucursales = async () => {
      try {
        const res = await fetch("/api/sucursales");
        const data = await res.json();
        setSucursales(data);
        
        if (data.length > 0) {
          if (rol !== "admin" && sucursalUsuario) {
            const sucursal = data.find((s: Sucursal) => s.nombre === sucursalUsuario);
            setOrigen(sucursal?.nombre || data[0].nombre);
          } else {
            setOrigen(data[0].nombre);
          }
          const destinoDefault = data.find((s: Sucursal) => s.nombre !== origen)?.nombre || data[0].nombre;
          setDestino(destinoDefault);
        }
      } catch (error) {
        addToast("Error al cargar sucursales", "error");
      }
    };
    
    fetchSucursales();
  }, [rol, sucursalUsuario]);

  // Cargar productos de la sucursal origen
  useEffect(() => {
    if (origen) {
      fetchProductosPorSucursal(origen);
    }
  }, [origen]);

  // Sistema de notificaciones
  const addToast = (message: string, type: 'success' | 'error' | 'warning') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Fetch productos por sucursal
  const fetchProductosPorSucursal = async (sucursalNombre: string) => {
    setIsLoadingProductos(true);
    try {
      const res = await fetch(`/api/inventario?sucursal=${encodeURIComponent(sucursalNombre)}&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const productosConStock = Array.isArray(data) 
          ? data.filter((p: any) => (p.stock || 0) > 0)
          : [];
        setProductos(productosConStock);
      }
    } catch (error) {
      console.error("Error cargando productos:", error);
    } finally {
      setIsLoadingProductos(false);
    }
  };

  // Fetch historial de traslados
  const fetchHistorialTraslados = async () => {
    setIsLoadingHistorial(true);
    try {
      const res = await fetch(`/api/traslados?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setTraslados(data.traslados || []);
      }
    } catch (error) {
      console.error("Error cargando historial:", error);
      addToast("Error al cargar el historial", "error");
    } finally {
      setIsLoadingHistorial(false);
    }
  };

  // Filtrar productos por búsqueda
  const productosFiltrados = productos
    .filter(p => 
      p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.sku?.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.talla?.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.color?.toLowerCase().includes(busqueda.toLowerCase())
    )
    .filter(p => !listaTraslado.some(item => item.producto_id === p.id));

  // Seleccionar producto y agregar a la lista
  const agregarProductoALista = () => {
    if (!productoSeleccionado) {
      addToast("Selecciona un producto", "warning");
      return;
    }

    const cantidadNumerica = parseInt(cantidad);
    if (!cantidadNumerica || cantidadNumerica <= 0) {
      addToast("Ingresa una cantidad válida", "warning");
      return;
    }

    if (cantidadNumerica > productoSeleccionado.stock) {
      addToast(`Stock insuficiente. Solo hay ${productoSeleccionado.stock} unidades`, "error");
      return;
    }

    if (listaTraslado.some(item => item.producto_id === productoSeleccionado.id)) {
      addToast("El producto ya está en la lista de traslado", "warning");
      return;
    }

    const nuevoProducto: ProductoTraslado = {
      producto_id: productoSeleccionado.id,
      cantidad: cantidadNumerica,
      nombre: productoSeleccionado.nombre,
      sku: productoSeleccionado.sku,
      talla: productoSeleccionado.talla,
      color: productoSeleccionado.color,
      stock: productoSeleccionado.stock,
      precio: productoSeleccionado.precio,
      imagen: productoSeleccionado.imagen
    };

    setListaTraslado([...listaTraslado, nuevoProducto]);
    setProductoSeleccionado(null);
    setCantidad("");
    setBusqueda("");
    setShowProductos(false);
    
    addToast("Producto agregado al traslado", "success");
  };

  // Eliminar producto de la lista
  const eliminarDeLista = (productoId: number) => {
    setListaTraslado(listaTraslado.filter(item => item.producto_id !== productoId));
    addToast("Producto eliminado de la lista", "success");
  };

  // Actualizar cantidad en la lista
  const actualizarCantidad = (productoId: number, nuevaCantidad: number) => {
    const producto = productos.find(p => p.id === productoId);
    if (!producto) return;

    if (nuevaCantidad > producto.stock) {
      addToast(`Stock insuficiente. Solo hay ${producto.stock} unidades`, "error");
      return;
    }

    if (nuevaCantidad < 1) {
      eliminarDeLista(productoId);
      return;
    }

    setListaTraslado(listaTraslado.map(item => 
      item.producto_id === productoId 
        ? { ...item, cantidad: nuevaCantidad }
        : item
    ));
  };

  // Validar que origen y destino sean diferentes
  const getDestinosDisponibles = () => {
    return sucursales.filter(s => s.nombre !== origen);
  };

  // Calcular total de productos y unidades
  const totalProductos = listaTraslado.length;
  const totalUnidades = listaTraslado.reduce((sum, item) => sum + item.cantidad, 0);

  // Enviar traslado
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (listaTraslado.length === 0) {
      addToast("Agrega al menos un producto para trasladar", "warning");
      return;
    }

    if (origen === destino) {
      addToast("La sucursal origen y destino deben ser diferentes", "error");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/traslados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origen: origen,
          destino: destino,
          productos: listaTraslado.map(item => ({
            producto_id: item.producto_id,
            cantidad: item.cantidad
          })),
          observacion: observacion || `Traslado de ${totalUnidades} unidades`
        }),
      });

      const data = await res.json();

      if (res.ok) {
        addToast("✅ Traslado registrado exitosamente", "success");
        
        setListaTraslado([]);
        setObservacion("");
        setProductoSeleccionado(null);
        setCantidad("");
        
        fetchProductosPorSucursal(origen);
        
        if (verHistorial) {
          fetchHistorialTraslados();
        }
      } else {
        addToast(data.error || "Error al registrar traslado", "error");
      }
    } catch (error) {
      addToast("Error de conexión con el servidor", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Ver detalles del traslado - CORREGIDO: llama a la API individual
  const verDetallesTraslado = async (traslado: Traslado) => {
    try {
      setIsLoadingHistorial(true);
      const res = await fetch(`/api/traslados/${traslado.id}?_t=${Date.now()}`);
      const data = await res.json();

      if (res.ok && data.traslado) {
        setTrasladoSeleccionado(data.traslado);
        setShowDetalleModal(true);
      } else {
        addToast("Error al cargar detalles del traslado", "error");
      }
    } catch (error) {
      addToast("Error al obtener detalles", "error");
    } finally {
      setIsLoadingHistorial(false);
    }
  };

  // Confirmar y eliminar traslado
  const confirmarEliminarTraslado = async () => {
    if (!trasladoAEliminar) return;

    try {
      setEliminando(true);
      const res = await fetch(`/api/traslados/${trasladoAEliminar}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok) {
        addToast("Registro eliminado correctamente", "success");
        fetchHistorialTraslados();
        setTrasladoAEliminar(null);
      } else {
        addToast(data.error || "Error al eliminar", "error");
      }
    } catch (error) {
      addToast("Error al eliminar registro", "error");
    } finally {
      setEliminando(false);
    }
  };

  // Cambiar entre formulario e historial
  const toggleView = () => {
    setVerHistorial(!verHistorial);
    if (!verHistorial) {
      fetchHistorialTraslados();
    }
  };

  if (status === "loading") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-black" />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500 animate-pulse">
            Cargando Sistema de Traslados...
          </span>
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
            <h1 className="text-3xl font-black uppercase tracking-tight text-gray-900 flex items-center gap-3">
              <Package className="text-gray-700" size={32} />
              {verHistorial ? "Historial de Traslados" : "Registrar Traslado"}
            </h1>
            <p className="text-sm font-medium text-gray-500 mt-2 flex items-center gap-2">
              <Store size={14} />
              {verHistorial 
                ? "Consulta todos los movimientos entre sucursales" 
                : "Transferencia de productos entre sucursales"}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={toggleView}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${
                verHistorial 
                  ? 'bg-black text-white shadow-lg' 
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <History size={16} />
              {verHistorial ? "Nuevo Traslado" : "Ver Historial"}
            </button>
          </div>
        </header>

        {verHistorial ? (
          /* ===== SECCIÓN DE HISTORIAL ===== */
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-black uppercase text-gray-900 flex items-center gap-2">
                <History size={20} />
                Historial de Traslados
              </h2>
            </div>

            {isLoadingHistorial ? (
              <div className="p-12 text-center">
                <Loader2 size={32} className="animate-spin mx-auto text-gray-400" />
                <p className="text-sm text-gray-500 mt-4">Cargando historial...</p>
              </div>
            ) : traslados.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package size={32} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">No hay traslados registrados</h3>
                <p className="text-sm text-gray-500">
                  Los traslados que realices aparecerán aquí
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase">Fecha</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase">Origen</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase">Destino</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase">Productos</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase">Unidades</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase">Realizado por</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {traslados.map((traslado) => (
                      <tr key={traslado.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-gray-400" />
                            <span className="text-sm text-gray-900">
                              {new Date(traslado.fecha).toLocaleDateString('es-MX')}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-500">
                            {new Date(traslado.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-900">{traslado.sucursal_origen}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-900">{traslado.sucursal_destino}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-gray-900">{traslado.total_productos}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-gray-900">{traslado.total_cantidad}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <User size={14} className="text-gray-400" />
                            <span className="text-sm text-gray-600">{traslado.usuario_nombre}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => verDetallesTraslado(traslado)}
                              className="px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors"
                            >
                              Ver Detalles
                            </button>
                            {rol === "admin" && (
                              <button
                                onClick={() => setTrasladoAEliminar(traslado.id)}
                                className="p-2 rounded-lg hover:bg-red-100 transition-colors"
                                title="Eliminar registro"
                              >
                                <Trash2 size={16} className="text-red-600" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* ===== FORMULARIO DE TRASLADO ===== */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Columna izquierda - Formulario */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-lg font-black uppercase text-gray-900 flex items-center gap-2">
                    <ArrowRight size={20} />
                    Detalles del Traslado
                  </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  
                  {/* Sucursales Origen/Destino */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">
                        Sucursal Origen <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={origen}
                        onChange={(e) => {
                          setOrigen(e.target.value);
                          setListaTraslado([]);
                          setProductoSeleccionado(null);
                          setCantidad("");
                        }}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-black/5 focus:bg-white transition-all"
                        required
                        disabled={rol !== "admin"}
                      >
                        {sucursales.map((s) => (
                          <option key={s.id} value={s.nombre}>{s.nombre}</option>
                        ))}
                      </select>
                      {rol !== "admin" && (
                        <p className="text-[10px] text-gray-500 mt-2">
                          Solo puedes trasladar desde tu sucursal asignada
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">
                        Sucursal Destino <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={destino}
                        onChange={(e) => setDestino(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-black/5 focus:bg-white transition-all"
                        required
                      >
                        {getDestinosDisponibles().map((s) => (
                          <option key={s.id} value={s.nombre}>{s.nombre}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Selector de Producto */}
                  <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                    <h3 className="text-xs font-black uppercase text-gray-700 mb-3 flex items-center gap-2">
                      <Package size={14} />
                      Agregar Producto
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                          type="text"
                          placeholder="Buscar producto por nombre, SKU, talla o color..."
                          className="w-full bg-white border border-gray-200 rounded-xl pl-12 pr-4 py-3.5 text-sm font-medium outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                          value={busqueda}
                          onChange={(e) => {
                            setBusqueda(e.target.value);
                            setShowProductos(true);
                          }}
                          onFocus={() => setShowProductos(true)}
                        />
                      </div>

                      {showProductos && (
                        <div className="border border-gray-200 rounded-xl bg-white shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                          {isLoadingProductos ? (
                            <div className="p-8 text-center">
                              <Loader2 size={24} className="animate-spin mx-auto text-gray-400" />
                              <p className="text-xs text-gray-500 mt-2">Cargando productos...</p>
                            </div>
                          ) : productosFiltrados.length === 0 ? (
                            <div className="p-8 text-center">
                              <Package size={32} className="mx-auto text-gray-300" />
                              <p className="text-xs font-bold uppercase text-gray-400 mt-2">
                                {busqueda ? "No se encontraron productos" : "No hay productos disponibles"}
                              </p>
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {productosFiltrados.slice(0, 5).map((prod) => (
                                <button
                                  key={prod.id}
                                  type="button"
                                  onClick={() => {
                                    setProductoSeleccionado(prod);
                                    setCantidad("1");
                                    setShowProductos(false);
                                    setBusqueda("");
                                  }}
                                  className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                                >
                                  <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                    {prod.imagen ? (
                                      <img src={prod.imagen} alt={prod.nombre} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <Package size={16} className="text-gray-400" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-xs text-gray-900 uppercase truncate">
                                      {prod.nombre}
                                    </p>
                                    <p className="text-[9px] text-gray-500 mt-0.5">
                                      SKU: {prod.sku} | Stock: {prod.stock}
                                    </p>
                                  </div>
                                </button>
                              ))}
                              {productosFiltrados.length > 5 && (
                                <div className="p-2 text-center">
                                  <p className="text-[9px] text-gray-500">
                                    +{productosFiltrados.length - 5} productos más
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {productoSeleccionado && (
                        <div className="bg-white border border-gray-200 rounded-xl p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                                {productoSeleccionado.imagen ? (
                                  <img 
                                    src={productoSeleccionado.imagen} 
                                    alt={productoSeleccionado.nombre}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                    <Package size={20} className="text-gray-400" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 uppercase text-sm">
                                  {productoSeleccionado.nombre}
                                </p>
                                <p className="text-[10px] text-gray-500 mt-0.5">
                                  SKU: {productoSeleccionado.sku} | Stock: {productoSeleccionado.stock}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setProductoSeleccionado(null)}
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <X size={16} className="text-gray-400 hover:text-red-500" />
                            </button>
                          </div>

                          <div className="flex items-center gap-3 mt-3">
                            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setCantidad(Math.max(1, parseInt(cantidad) - 1).toString())}
                                className="px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                              >
                                <Minus size={14} className="text-gray-600" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={productoSeleccionado.stock}
                                value={cantidad}
                                onChange={(e) => setCantidad(e.target.value)}
                                className="w-16 text-center py-2 text-sm font-bold border-x border-gray-200 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setCantidad(Math.min(productoSeleccionado.stock, parseInt(cantidad) + 1).toString())}
                                className="px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                              >
                                <Plus size={14} className="text-gray-600" />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={agregarProductoALista}
                              className="flex-1 bg-black text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                            >
                              <Plus size={14} />
                              Agregar a Traslado
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lista de productos a trasladar */}
                  {listaTraslado.length > 0 && (
                    <div className="border border-gray-200 rounded-xl p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xs font-black uppercase text-gray-700 flex items-center gap-2">
                          <Package size={14} />
                          Productos a Trasladar ({totalProductos} productos, {totalUnidades} unidades)
                        </h3>
                      </div>
                      
                      <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                        {listaTraslado.map((item) => (
                          <div key={item.producto_id} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white rounded-lg overflow-hidden border border-gray-200">
                                {item.imagen ? (
                                  <img src={item.imagen} alt={item.nombre} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package size={16} className="text-gray-400" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-xs text-gray-900 uppercase">{item.nombre}</p>
                                <p className="text-[9px] text-gray-500">
                                  SKU: {item.sku} | Stock: {item.stock}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                                <button
                                  type="button"
                                  onClick={() => actualizarCantidad(item.producto_id, item.cantidad - 1)}
                                  className="px-2 py-1.5 hover:bg-gray-100 transition-colors"
                                >
                                  <Minus size={12} className="text-gray-600" />
                                </button>
                                <span className="w-8 text-center text-xs font-bold">{item.cantidad}</span>
                                <button
                                  type="button"
                                  onClick={() => actualizarCantidad(item.producto_id, item.cantidad + 1)}
                                  className="px-2 py-1.5 hover:bg-gray-100 transition-colors"
                                >
                                  <Plus size={12} className="text-gray-600" />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => eliminarDeLista(item.producto_id)}
                                className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                              >
                                <Trash2 size={14} className="text-gray-400 hover:text-red-500" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Observación */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">
                      Observación <span className="text-gray-300">(Opcional)</span>
                    </label>
                    <textarea
                      value={observacion}
                      onChange={(e) => setObservacion(e.target.value)}
                      placeholder="Notas adicionales sobre el traslado..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-black/5 focus:bg-white transition-all resize-none"
                      rows={2}
                    />
                  </div>

                  {/* Botón Guardar */}
                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isLoading || listaTraslado.length === 0}
                      className="w-full bg-black text-white py-4 rounded-xl text-xs font-bold uppercase tracking-[0.2em] shadow-xl hover:bg-gray-900 hover:scale-[1.01] transition-all active:scale-[0.99] disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <ArrowRight size={16} />
                          Confirmar Traslado ({totalUnidades} unidades)
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Columna derecha - Información y reglas */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sticky top-6">
                <h3 className="text-sm font-black uppercase text-gray-900 mb-4 flex items-center gap-2">
                  <AlertCircle size={16} />
                  Reglas de Traslado
                </h3>
                
                <div className="space-y-4 text-xs text-gray-600">
                  <div className="flex gap-2">
                    <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-gray-600">1</span>
                    </div>
                    <p>El origen y destino deben ser diferentes</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-gray-600">2</span>
                    </div>
                    <p>Solo se pueden trasladar productos con stock disponible</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-gray-600">3</span>
                    </div>
                    <p>Puedes agregar múltiples productos a un mismo traslado</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-gray-600">4</span>
                    </div>
                    <p>El stock se descuenta de origen y se agrega a destino</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-gray-600">5</span>
                    </div>
                    <p>Los traslados quedan registrados en el historial con detalles</p>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Resumen</p>
                  <div className="space-y-2">
                    <p className="text-sm font-black text-gray-900 flex items-center gap-2">
                      <Store size={16} className="text-gray-600" />
                      {origen || "No seleccionada"}
                    </p>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-500">Productos disponibles:</span>
                      <span className="font-bold text-gray-900">{productos.length}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-500">Productos a trasladar:</span>
                      <span className="font-bold text-gray-900">{totalProductos}</span>
                    </div>
                    <div className="flex justify-between text-[10px] pt-1 border-t border-gray-200">
                      <span className="text-gray-500">Total unidades:</span>
                      <span className="font-bold text-black">{totalUnidades}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- MODAL DE DETALLES DEL TRASLADO --- */}
      {showDetalleModal && trasladoSeleccionado && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowDetalleModal(false)}></div>
          <div className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0">
              <div>
                <h3 className="text-lg font-black uppercase text-gray-900 flex items-center gap-2">
                  <Package size={20} />
                  Detalles del Traslado #{trasladoSeleccionado?.id || ''}
                </h3>
                <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-2">
                  <Calendar size={12} />
                  {trasladoSeleccionado?.fecha 
                    ? new Date(trasladoSeleccionado.fecha).toLocaleString('es-MX')
                    : ''}
                </p>
              </div>
              <button
                onClick={() => setShowDetalleModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6 overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(80vh - 120px)' }}>
              
              {/* Información del traslado */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase text-gray-500 mb-1">Sucursal Origen</p>
                    <p className="text-sm font-bold text-gray-900 flex items-center gap-1">
                      <Store size={14} className="text-gray-600" />
                      {trasladoSeleccionado?.sucursal_origen || 'No especificada'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase text-gray-500 mb-1">Sucursal Destino</p>
                    <p className="text-sm font-bold text-gray-900 flex items-center gap-1">
                      <Store size={14} className="text-gray-600" />
                      {trasladoSeleccionado?.sucursal_destino || 'No especificada'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase text-gray-500 mb-1">Realizado por</p>
                    <p className="text-xs font-medium text-gray-900 flex items-center gap-1">
                      <User size={12} className="text-gray-500" />
                      {trasladoSeleccionado?.usuario_nombre || 'Desconocido'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase text-gray-500 mb-1">Estado</p>
                    <span className="inline-flex px-2 py-1 bg-green-100 text-green-700 rounded-full text-[9px] font-bold uppercase">
                      {trasladoSeleccionado?.estado || 'Completado'}
                    </span>
                  </div>
                </div>
                
                {trasladoSeleccionado?.observacion && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-[9px] font-bold uppercase text-gray-500 mb-1">Observación</p>
                    <p className="text-xs text-gray-700">{trasladoSeleccionado.observacion}</p>
                  </div>
                )}
              </div>

              {/* Productos trasladados */}
              <h4 className="text-xs font-black uppercase text-gray-700 mb-3 flex items-center gap-2">
                <Package size={14} />
                Productos Trasladados ({trasladoSeleccionado?.detalles?.length || 0})
              </h4>

              <div className="space-y-3">
                {trasladoSeleccionado?.detalles?.map((detalle) => (
                  <div key={detalle?.id || Math.random()} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                        {detalle?.producto_imagen ? (
                          <img src={detalle.producto_imagen} alt={detalle?.producto_nombre || ''} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package size={20} className="text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-900 uppercase">{detalle?.producto_nombre || 'Sin nombre'}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          SKU: {detalle?.producto_sku || 'S/SKU'}
                        </p>
                        {(detalle?.producto_talla || detalle?.producto_color) && (
                          <p className="text-[9px] text-gray-600 mt-0.5">
                            {detalle?.producto_talla && `Talla: ${detalle.producto_talla} `}
                            {detalle?.producto_color && `Color: ${detalle.producto_color}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-gray-900">x{detalle?.cantidad || 0}</span>
                      {(detalle?.producto_precio || 0) > 0 && (
                        <p className="text-[9px] text-gray-500 mt-1">
                          ${detalle?.producto_precio || 0} c/u
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Resumen */}
              <div className="mt-6 p-4 bg-gray-900 rounded-xl text-white">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Total de productos</span>
                  <span className="text-lg font-black">{trasladoSeleccionado?.detalles?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-700">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Total de unidades</span>
                  <span className="text-lg font-black">{trasladoSeleccionado?.total_cantidad || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE ELIMINAR TRASLADO --- */}
      {trasladoAEliminar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-[400px] p-6 animate-in fade-in zoom-in-95">
            
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              Eliminar Registro
            </h3>

            <p className="text-sm text-gray-600 mb-6">
              ¿Estás seguro que deseas eliminar este registro?
              Esta acción no afectará el stock, solo eliminará el historial.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setTrasladoAEliminar(null)}
                className="px-4 py-2 rounded-lg border text-gray-600 hover:bg-gray-100 transition"
              >
                Cancelar
              </button>

              <button
                onClick={confirmarEliminarTraslado}
                disabled={eliminando}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50"
              >
                {eliminando ? "Eliminando..." : "Eliminar"}
              </button>
            </div>

          </div>
        </div>
      )}

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
    </div>
  );
}