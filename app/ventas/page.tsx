"use client";

import Sidebar from "@/app/components/Sidebar";
import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Toaster, toast } from "sonner"; // ✅ Alertas bonitas
import {
  RefreshCw,
  Trash2,
  ShoppingCart,
  Package,
  Plus,
  Minus,
  Search,
  CreditCard,
  Banknote,
  Landmark,
  Store,
  Tag,
  AlertCircle,
  ImageOff,
  Loader2
} from "lucide-react";

/* =======================
   TIPOS
======================= */
interface Producto {
  varianteId: number;
  productoId: number;
  nombre: string;
  sku: string;
  descripcion: string;
  talla: string | null;
  color: string | null;
  imagen: string | null;
  precio: number;
  stock: number;
}

interface ItemCarrito extends Producto {
  cantidad: number;
}

/* =======================
   COMPONENTE PRINCIPAL
======================= */
export default function VentasPage() {
  const { data: session, status } = useSession();

  // Estados
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [sucursalNombre, setSucursalNombre] = useState("Cargando...");
  const [inventarioGlobal, setInventarioGlobal] = useState<Producto[]>([]);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cliente, setCliente] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [metodoPago, setMetodoPago] = useState<"Efectivo" | "Tarjeta" | "Transferencia">("Efectivo");
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  /* =======================
     CONSTANTES & MAPAS
  ======================= */
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

  /* =======================
     CONFIGURAR SUCURSAL
  ======================= */
  useEffect(() => {
    if (status === "loading" || !session?.user) return;

    const user: any = session.user;
    const isAdmin = user.role?.toLowerCase() === "admin";

    if (isAdmin) {
      const nombre = localStorage.getItem("sucursalActiva") || user.sucursal || "Centro Isidro Huarte 1";
      setSucursalNombre(nombre);
      setSucursalId(SUCURSALES_MAP[nombre] || 1);
    } else {
      const id = user.sucursal_id || 1;
      const nombre = user.sucursal || ID_SUCURSALES_MAP[id] || "Centro Isidro Huarte 1";
      setSucursalId(id);
      setSucursalNombre(nombre);
    }
  }, [session, status]);

  /* =======================
     CARGAR PRODUCTOS
  ======================= */
  const cargarProductos = useCallback(async () => {
    if (!sucursalNombre || sucursalNombre === "Cargando...") {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(
        `/api/inventario?sucursal=${encodeURIComponent(sucursalNombre)}`,
        {
          credentials: "include",
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText);
      }

      const data = await res.json();

      const productosFormateados: Producto[] = Array.isArray(data)
        ? data.map((p: any) => ({
            varianteId: Number(p.varianteId),
            productoId: Number(p.productoId),
            nombre: p.nombre?.trim() || "Sin nombre",
            sku: p.sku?.trim() || "N/A",
            descripcion: p.descripcion?.trim() || "",
            talla: p.talla?.trim() || null,
            color: p.color?.trim() || null,
            imagen: p.imagen || null,
            precio: Number(p.precio) || 0,
            stock: Number(p.stock) || 0,
          }))
        : [];

      setInventarioGlobal(productosFormateados.filter(p => p.varianteId > 0));
      
    } catch (err: any) {
      toast.error("Error al cargar inventario", {
        description: "No se pudieron obtener los productos de la sucursal."
      });
      setInventarioGlobal([]);
    } finally {
      setIsLoading(false);
    }
  }, [sucursalNombre]);

  useEffect(() => {
    if (sucursalId && sucursalNombre !== "Cargando...") {
      cargarProductos();
    }
  }, [sucursalId, sucursalNombre, cargarProductos]);

  /* =======================
     LOGICA CARRITO
  ======================= */
  const agregarAlCarrito = (producto: Producto) => {
    if (producto.stock <= 0) {
      toast.warning("Stock agotado", { description: `No hay unidades disponibles de ${producto.nombre}` });
      return;
    }

    setCarrito((prev) => {
      const existe = prev.find((item) => item.varianteId === producto.varianteId);
      const cantidadActual = existe ? existe.cantidad : 0;

      if (cantidadActual + 1 > producto.stock) {
        toast.error("Stock insuficiente", { 
            description: `Solo quedan ${producto.stock} unidades disponibles.` 
        });
        return prev;
      }

      toast.success("Producto agregado", { 
          description: `${producto.nombre} añadido al carrito`,
          duration: 1500,
          icon: <Plus className="w-4 h-4 text-green-500"/>
      });

      if (existe) {
        return prev.map((item) =>
          item.varianteId === producto.varianteId
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }

      return [...prev, { ...producto, cantidad: 1 }];
    });
  };

  const eliminarDelCarrito = (varianteId: number) => {
    setCarrito((prev) => prev.filter((item) => item.varianteId !== varianteId));
    toast.info("Producto eliminado del carrito");
  };

  const actualizarCantidad = (varianteId: number, nuevaCantidad: number) => {
    if (nuevaCantidad < 1) {
      eliminarDelCarrito(varianteId);
      return;
    }

    const producto = inventarioGlobal.find(p => p.varianteId === varianteId);
    if (!producto) return;

    if (nuevaCantidad > producto.stock) {
      toast.error("Límite de stock alcanzado");
      return;
    }

    setCarrito((prev) =>
      prev.map((item) =>
        item.varianteId === varianteId
          ? { ...item, cantidad: nuevaCantidad }
          : item
      )
    );
  };

  const vaciarCarrito = () => {
    if (carrito.length === 0) return;
    const confirm = window.confirm("¿Estás seguro de vaciar el carrito?"); 
    // Nota: window.confirm es aceptable, pero podrías usar un modal custom.
    if (confirm) {
        setCarrito([]);
        toast.info("Carrito vaciado");
    }
  };

  /* =======================
     PROCESAR VENTA
  ======================= */
  const handleCobrar = async () => {
    if (!sucursalId) {
      toast.error("Error de sucursal", { description: "Recarga la página." });
      return;
    }

    if (carrito.length === 0) {
      toast.warning("El carrito está vacío");
      return;
    }

    if (isProcessing) return;
    setIsProcessing(true);
    const toastId = toast.loading("Procesando venta...");

    try {
      const res = await fetch("/api/ventas", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productos: carrito.map((p) => ({
            varianteId: p.varianteId,
            cantidad: p.cantidad,
          })),
          sucursal_id: sucursalId,
          metodo_pago: metodoPago,
          cliente: cliente.trim() || null,
          observaciones: observaciones.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "No se pudo procesar la venta");
      }

      setCarrito([]);
      setCliente("");
      setObservaciones("");
      await cargarProductos();
      
      toast.dismiss(toastId);
      toast.success(`¡Venta #${data.ventaId} Exitosa!`, {
        description: `Total cobrado: ${formatMoney(totalVenta)}`,
        duration: 5000,
        icon: <Package className="h-5 w-5 text-green-600"/>
      });

    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error("Error al procesar", { description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  /* =======================
     UTILIDADES
  ======================= */
  const productosVisibles = useMemo(() => {
    if (!busqueda.trim()) return inventarioGlobal;
    const term = busqueda.toLowerCase().trim();
    return inventarioGlobal.filter(
      (p) =>
        p.nombre.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.color && p.color.toLowerCase().includes(term))
    );
  }, [busqueda, inventarioGlobal]);

  const totalVenta = useMemo(() => 
    carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0),
    [carrito]
  );

  const formatMoney = (n: number) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2
    }).format(n);

  /* =======================
     RENDER
  ======================= */
  if (status === "loading") {
    return (
      <div className="flex h-screen w-full bg-slate-50 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <p className="text-slate-500 font-medium">Iniciando sistema...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen w-full bg-slate-100 justify-center items-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
          <AlertCircle className="h-16 w-16 mx-auto text-amber-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Acceso Restringido</h2>
          <p className="text-slate-500 mb-6">Necesitas iniciar sesión para acceder al terminal de punto de venta.</p>
          <button
            onClick={() => window.location.href = '/api/auth/signin'}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all"
          >
            Ir al Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-100 font-sans text-slate-800 overflow-hidden">
      <Toaster position="top-right" richColors />
      <Sidebar />

      <main className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
        
        {/* ========================
            PANEL IZQUIERDO: CATÁLOGO
        ========================= */}
        <section className="flex-1 flex flex-col h-full overflow-hidden border-r border-slate-200 bg-white">
          
          {/* Header Sucursal */}
          <header className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white z-10">
            <div>
              <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                <Store size={14} />
                <span>Sucursal ID: {sucursalId}</span>
              </div>
              <h1 className="font-bold text-xl text-slate-800 leading-tight">{sucursalNombre}</h1>
            </div>
            
            <div className="flex items-center gap-2">
                <button
                    onClick={cargarProductos}
                    disabled={isLoading}
                    className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Actualizar inventario"
                >
                    <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
                </button>
            </div>
          </header>

          {/* Buscador */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
              <input
                type="text"
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                placeholder="Buscar por nombre, SKU, color..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>

          {/* Grid de Productos */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
            {isLoading ? (
               <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                 {[...Array(6)].map((_, i) => (
                   <div key={i} className="h-64 bg-slate-200 rounded-xl animate-pulse"></div>
                 ))}
               </div>
            ) : productosVisibles.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Package className="h-16 w-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">No se encontraron productos</p>
                <p className="text-sm">Intenta con otro término de búsqueda</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 pb-20">
                {productosVisibles.map((producto) => {
                  const enCarrito = carrito.find(item => item.varianteId === producto.varianteId);
                  const cantidadEnCarrito = enCarrito ? enCarrito.cantidad : 0;
                  const stockReal = producto.stock - cantidadEnCarrito;
                  const sinStock = stockReal <= 0;

                  return (
                    <article 
                      key={producto.varianteId} 
                      className={`group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col ${sinStock ? 'opacity-70 grayscale-[0.5]' : ''}`}
                    >
                      {/* Imagen */}
                      <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                        {producto.imagen ? (
                          <img 
                            src={producto.imagen} 
                            alt={producto.nombre}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => (e.currentTarget.src = "/placeholder.png")} // Fallback simple
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <ImageOff size={40} />
                          </div>
                        )}
                        
                        {/* Badges Flotantes */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                            {producto.talla && (
                                <span className="bg-white/90 backdrop-blur text-xs font-bold px-2 py-1 rounded-md shadow-sm text-slate-700">
                                    {producto.talla}
                                </span>
                            )}
                            {producto.color && (
                                <span className="bg-white/90 backdrop-blur text-xs font-bold px-2 py-1 rounded-md shadow-sm flex items-center gap-1 text-slate-700">
                                    <span className="w-2 h-2 rounded-full bg-current" style={{ color: producto.color.toLowerCase() }}></span>
                                    {producto.color}
                                </span>
                            )}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-4 flex-1 flex flex-col">
                        <div className="mb-2">
                            <p className="text-xs text-slate-400 font-mono mb-0.5">{producto.sku}</p>
                            <h3 className="font-bold text-slate-800 leading-snug line-clamp-2" title={producto.nombre}>
                                {producto.nombre}
                            </h3>
                        </div>

                        <div className="mt-auto pt-3 flex items-end justify-between border-t border-slate-50">
                            <div>
                                <p className="text-2xl font-bold text-slate-900 tracking-tight">
                                    {formatMoney(producto.precio)}
                                </p>
                                <p className={`text-xs font-medium mt-1 flex items-center gap-1 ${stockReal < 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    <Tag size={12} />
                                    {stockReal > 0 ? `${stockReal} disponibles` : 'Agotado'}
                                </p>
                            </div>
                            
                            <button
                                onClick={() => agregarAlCarrito(producto)}
                                disabled={sinStock}
                                className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors shadow-sm ${
                                    sinStock 
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
                                }`}
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ========================
            PANEL DERECHO: TICKET
        ========================= */}
        <aside className="w-full md:w-[400px] lg:w-[450px] bg-white border-l border-slate-200 flex flex-col h-full shadow-2xl shadow-slate-200/50 z-20">
          
          {/* Header Carrito */}
          <div className="p-5 border-b border-slate-100 bg-white">
            <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <ShoppingCart className="text-blue-600" size={20}/>
                    Orden de Venta
                </h2>
                <button 
                    onClick={vaciarCarrito}
                    disabled={carrito.length === 0}
                    className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded transition-colors disabled:opacity-50"
                >
                    Vaciar todo
                </button>
            </div>
            <p className="text-sm text-slate-500">
                {carrito.length} ítems agregados
            </p>
          </div>

          {/* Lista Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {carrito.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl m-2">
                <div className="bg-white p-4 rounded-full mb-3 shadow-sm">
                    <ShoppingCart size={32} className="text-slate-300" />
                </div>
                <p className="font-medium text-slate-600">Carrito vacío</p>
                <p className="text-sm text-center max-w-[200px]">Selecciona productos del panel izquierdo para comenzar.</p>
              </div>
            ) : (
              carrito.map((item) => (
                <div key={item.varianteId} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex gap-3 group">
                    {/* Imagen Mini */}
                    <div className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                        {item.imagen ? (
                            <img src={item.imagen} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <ImageOff size={16} />
                            </div>
                        )}
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <h4 className="font-semibold text-slate-700 text-sm truncate pr-2">{item.nombre}</h4>
                            <p className="font-bold text-slate-900 text-sm">{formatMoney(item.precio * item.cantidad)}</p>
                        </div>
                        
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                            {item.color && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300"></span>{item.color}</span>}
                            {item.talla && <span>• Talla: {item.talla}</span>}
                        </div>

                        {/* Controles Cantidad */}
                        <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                                <button 
                                    onClick={() => actualizarCantidad(item.varianteId, item.cantidad - 1)}
                                    className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-white hover:shadow-sm rounded-md transition-all"
                                >
                                    <Minus size={14} />
                                </button>
                                <span className="w-8 text-center text-sm font-bold text-slate-700">{item.cantidad}</span>
                                <button 
                                    onClick={() => actualizarCantidad(item.varianteId, item.cantidad + 1)}
                                    className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-white hover:shadow-sm rounded-md transition-all"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>

                            <button 
                                onClick={() => eliminarDelCarrito(item.varianteId)}
                                className="text-slate-400 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Pago */}
          <div className="bg-white border-t border-slate-200 p-5 shadow-[0_-5px_20px_-10px_rgba(0,0,0,0.1)] z-10">
            
            {/* Inputs Cliente y Notas */}
            <div className="space-y-3 mb-4">
                <input
                    type="text"
                    placeholder="Nombre del cliente (Opcional)"
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                />
                <textarea
                    rows={1}
                    placeholder="Observaciones..."
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                />
            </div>

            {/* Selector Método Pago */}
            <div className="grid grid-cols-3 gap-2 mb-6">
                {[
                    { id: "Efectivo", icon: Banknote, label: "Efectivo" },
                    { id: "Tarjeta", icon: CreditCard, label: "Tarjeta" },
                    { id: "Transferencia", icon: Landmark, label: "Transf." },
                ].map((m) => (
                    <button
                        key={m.id}
                        onClick={() => setMetodoPago(m.id as any)}
                        className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border transition-all duration-200 ${
                            metodoPago === m.id 
                            ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200" 
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                    >
                        <m.icon size={20} className="mb-1" />
                        <span className="text-[10px] font-medium uppercase tracking-wide">{m.label}</span>
                    </button>
                ))}
            </div>

            {/* Total y Botón */}
            <div className="space-y-4">
                <div className="flex justify-between items-end">
                    <span className="text-slate-500 font-medium">Total a Pagar</span>
                    <span className="text-3xl font-black text-slate-800 tracking-tight">{formatMoney(totalVenta)}</span>
                </div>
                
                <button
                    onClick={handleCobrar}
                    disabled={isProcessing || carrito.length === 0}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg shadow-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                    {isProcessing ? (
                        <>
                            <Loader2 className="animate-spin" /> Procesando...
                        </>
                    ) : (
                        <>
                           Cobrar {formatMoney(totalVenta)}
                        </>
                    )}
                </button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}