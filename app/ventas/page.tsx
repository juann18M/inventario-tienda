"use client";

import Sidebar from "@/app/components/Sidebar";
import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Toaster, toast } from "sonner";
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
  Loader2,
  ChevronLeft,
  ChevronRight,
  X
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
  const [showCarrito, setShowCarrito] = useState(false); // ✅ Controla visibilidad del carrito en móvil

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

  // 🔥 usamos lo que realmente viene de NextAuth
  const sucursalNombreSesion = user.sucursal_nombre;
  const sucursalIdSesion = user.sucursal_id;

  if (isAdmin) {
    const nombre =
      localStorage.getItem("sucursalActiva") ||
      sucursalNombreSesion ||
      "Centro Isidro Huarte 1";

    setSucursalNombre(nombre);
    setSucursalId(SUCURSALES_MAP[nombre] || sucursalIdSesion || 1);

  } else {
    // 👤 Empleado SIEMPRE usa su sucursal real
    setSucursalNombre(sucursalNombreSesion || "Centro Isidro Huarte 1");
    setSucursalId(sucursalIdSesion || 1);
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

    // ✅ En móvil, mostrar el carrito automáticamente cuando se agrega un producto
    if (window.innerWidth < 768) {
      setShowCarrito(true);
    }
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
    if (window.confirm("¿Estás seguro de vaciar el carrito?")) {
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
      <div className="flex h-screen w-full bg-slate-100 justify-center items-center p-4">
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

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* ========================
            HEADER MÓVIL - BOTÓN CARRITO
        ========================= */}
        <div className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-30">
          <div>
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <Store size={14} />
              <span>Sucursal ID: {sucursalId}</span>
            </div>
            <h1 className="font-bold text-base text-slate-800">{sucursalNombre}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cargarProductos}
              disabled={isLoading}
              className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setShowCarrito(!showCarrito)}
              className="relative p-2.5 bg-blue-600 text-white rounded-lg shadow-lg shadow-blue-200"
            >
              <ShoppingCart size={20} />
              {carrito.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full font-bold">
                  {carrito.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ========================
            CONTENEDOR PRINCIPAL MÓVIL/DESKTOP
        ========================= */}
        <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
          
          {/* PANEL IZQUIERDO: CATÁLOGO - Siempre visible pero con padding bottom en móvil */}
          <section className={`
            flex-1 flex flex-col h-full overflow-hidden bg-white
            ${showCarrito ? 'hidden md:flex' : 'flex'}
          `}>
            
            {/* Header Desktop (oculto en móvil) */}
            <header className="hidden md:flex px-6 py-4 border-b border-slate-100 justify-between items-center bg-white z-10">
              <div>
                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                  <Store size={14} />
                  <span>Sucursal ID: {sucursalId}</span>
                </div>
                <h1 className="font-bold text-xl text-slate-800 leading-tight">{sucursalNombre}</h1>
              </div>
              
              <button
                  onClick={cargarProductos}
                  disabled={isLoading}
                  className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Actualizar inventario"
              >
                  <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
              </button>
            </header>

            {/* Buscador - Siempre visible */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                <input
                  type="text"
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 md:py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                  placeholder="Buscar por nombre, SKU, color..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </div>

            {/* Grid de Productos - MEJORADO PARA MÓVIL */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 bg-slate-50">
              {isLoading ? (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-48 md:h-64 bg-slate-200 rounded-xl animate-pulse"></div>
                  ))}
                </div>
              ) : productosVisibles.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-4">
                  <Package className="h-16 w-16 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No se encontraron productos</p>
                  <p className="text-sm text-center">Intenta con otro término de búsqueda</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {productosVisibles.map((producto) => {
                    const enCarrito = carrito.find(item => item.varianteId === producto.varianteId);
                    const cantidadEnCarrito = enCarrito ? enCarrito.cantidad : 0;
                    const stockReal = producto.stock - cantidadEnCarrito;
                    const sinStock = stockReal <= 0;

                    return (
                      <article 
                        key={producto.varianteId} 
                        className={`
                          bg-white rounded-xl md:rounded-2xl border border-slate-200 shadow-sm 
                          overflow-hidden flex flex-col
                          ${sinStock ? 'opacity-70 grayscale-[0.5]' : ''}
                          hover:shadow-md transition-all duration-300
                        `}
                      >
                        {/* Imagen - Tamaño ajustado para móvil */}
                        <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
                          {producto.imagen ? (
                            <img 
                              src={producto.imagen} 
                              alt={producto.nombre}
                              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                              onError={(e) => (e.currentTarget.src = "/placeholder.png")}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <ImageOff size={24} />
                            </div>
                          )}
                          
                          {/* Badges - Simplificados para móvil */}
                          <div className="absolute top-1 left-1 flex flex-col gap-1">
                              {producto.talla && (
                                  <span className="bg-white/90 backdrop-blur text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm text-slate-700">
                                      {producto.talla}
                                  </span>
                              )}
                          </div>
                        </div>

                        {/* Info - Compacta para móvil */}
                        <div className="p-2 md:p-4">
                          <div className="mb-1">
                            <p className="text-[10px] text-slate-400 font-mono truncate">{producto.sku}</p>
                            <h3 className="font-semibold text-xs md:text-sm text-slate-800 line-clamp-2" title={producto.nombre}>
                                {producto.nombre}
                            </h3>
                          </div>

                          <div className="flex items-center justify-between mt-2">
                            <div>
                              <p className="text-sm md:text-base font-bold text-slate-900">
                                  {formatMoney(producto.precio)}
                              </p>
                              <p className={`text-[10px] font-medium ${stockReal < 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {stockReal > 0 ? `${stockReal} disp.` : 'Agotado'}
                              </p>
                            </div>
                            
                            <button
                                onClick={() => agregarAlCarrito(producto)}
                                disabled={sinStock}
                                className={`h-8 w-8 md:h-10 md:w-10 rounded-lg md:rounded-xl flex items-center justify-center transition-colors shadow-sm ${
                                    sinStock 
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                            >
                                <Plus size={16} className="md:size-20" />
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
              PANEL DERECHO: CARRITO MÓVIL (Slide-over)
          ========================= */}
          <aside className={`
            fixed md:relative inset-0 z-40 md:z-auto
            w-full md:w-[400px] lg:w-[450px] bg-white md:border-l border-slate-200 
            flex flex-col h-full shadow-2xl md:shadow-none
            transition-transform duration-300 ease-in-out
            ${showCarrito ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
          `}>
            
            {/* Header del carrito en móvil */}
            <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-2">
                <ShoppingCart className="text-blue-600" size={20}/>
                <h2 className="font-bold text-lg">Carrito de venta</h2>
              </div>
              <button
                onClick={() => setShowCarrito(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <ChevronRight size={24} />
              </button>
            </div>
            
            {/* Header Carrito Desktop */}
            <div className="hidden md:block p-5 border-b border-slate-100 bg-white">
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

            {/* Lista Items - Scrollable */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 md:space-y-3 bg-slate-50">
              {carrito.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl p-4">
                  <div className="bg-white p-4 rounded-full mb-3 shadow-sm">
                      <ShoppingCart size={32} className="text-slate-300" />
                  </div>
                  <p className="font-medium text-slate-600">Carrito vacío</p>
                  <p className="text-sm text-center max-w-[200px]">Selecciona productos del catálogo para comenzar.</p>
                  <button
                    onClick={() => setShowCarrito(false)}
                    className="mt-4 md:hidden bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-medium"
                  >
                    Ver catálogo
                  </button>
                </div>
              ) : (
                carrito.map((item) => (
                  <div key={item.varianteId} className="bg-white p-2 md:p-3 rounded-xl border border-slate-200 shadow-sm flex gap-2 md:gap-3">
                      {/* Imagen Mini */}
                      <div className="w-14 h-14 md:w-16 md:h-16 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
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
                              <h4 className="font-semibold text-slate-700 text-xs md:text-sm truncate pr-2">{item.nombre}</h4>
                              <p className="font-bold text-slate-900 text-xs md:text-sm">{formatMoney(item.precio * item.cantidad)}</p>
                          </div>
                          
                          <div className="text-[10px] md:text-xs text-slate-500 flex items-center gap-1 md:gap-2 mt-1">
                              {item.color && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300"></span>{item.color}</span>}
                              {item.talla && <span>• Talla: {item.talla}</span>}
                          </div>

                          {/* Controles Cantidad */}
                          <div className="flex items-center justify-between mt-2 md:mt-3">
                              <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                                  <button 
                                      onClick={() => actualizarCantidad(item.varianteId, item.cantidad - 1)}
                                      className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center text-slate-600 hover:bg-white hover:shadow-sm rounded-md transition-all"
                                  >
                                      <Minus size={12} />
                                  </button>
                                  <span className="w-6 md:w-8 text-center text-xs md:text-sm font-bold text-slate-700">{item.cantidad}</span>
                                  <button 
                                      onClick={() => actualizarCantidad(item.varianteId, item.cantidad + 1)}
                                      className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center text-slate-600 hover:bg-white hover:shadow-sm rounded-md transition-all"
                                  >
                                      <Plus size={12} />
                                  </button>
                              </div>

                              <button 
                                  onClick={() => eliminarDelCarrito(item.varianteId)}
                                  className="text-slate-400 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 transition-colors"
                              >
                                  <Trash2 size={14} className="md:size-16" />
                              </button>
                          </div>
                      </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Pago */}
            <div className="bg-white border-t border-slate-200 p-4 md:p-5 shadow-[0_-5px_20px_-10px_rgba(0,0,0,0.1)] z-10">
              
              {/* Inputs Cliente y Notas */}
              <div className="space-y-2 md:space-y-3 mb-3 md:mb-4">
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
              <div className="grid grid-cols-3 gap-1 md:gap-2 mb-4 md:mb-6">
                  {[
                      { id: "Efectivo", icon: Banknote, label: "Efectivo" },
                      { id: "Tarjeta", icon: CreditCard, label: "Tarjeta" },
                      { id: "Transferencia", icon: Landmark, label: "Transf." },
                  ].map((m) => (
                      <button
                          key={m.id}
                          onClick={() => setMetodoPago(m.id as any)}
                          className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg md:rounded-xl border transition-all duration-200 ${
                              metodoPago === m.id 
                              ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200" 
                              : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300"
                          }`}
                      >
                          <m.icon size={18} className="mb-1" />
                          <span className="text-[8px] md:text-[10px] font-medium uppercase tracking-wide">{m.label}</span>
                      </button>
                  ))}
              </div>

              {/* Total y Botón */}
              <div className="space-y-3 md:space-y-4">
                  <div className="flex justify-between items-end">
                      <span className="text-sm md:text-base text-slate-500 font-medium">Total a Pagar</span>
                      <span className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{formatMoney(totalVenta)}</span>
                  </div>
                  
                  <button
                      onClick={handleCobrar}
                      disabled={isProcessing || carrito.length === 0}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 md:py-4 rounded-xl shadow-lg shadow-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm md:text-base"
                  >
                      {isProcessing ? (
                          <>
                              <Loader2 className="animate-spin size-4" /> Procesando...
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

          {/* Overlay para móvil cuando el carrito está abierto */}
          {showCarrito && (
            <div 
              className="fixed inset-0 bg-black/50 z-30 md:hidden"
              onClick={() => setShowCarrito(false)}
            />
          )}
        </div>

        {/* Botón flotante del carrito para móvil (cuando está oculto) */}
        {!showCarrito && carrito.length > 0 && (
          <button
            onClick={() => setShowCarrito(true)}
            className="md:hidden fixed bottom-4 right-4 bg-blue-600 text-white p-4 rounded-full shadow-lg shadow-blue-300 z-40 flex items-center gap-2"
          >
            <ShoppingCart size={24} />
            <span className="font-bold text-lg">{carrito.length}</span>
          </button>
        )}
      </main>
    </div>
  );
}