"use client";

import Sidebar from "../components/Sidebar";
import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Search, 
  PackagePlus, 
  Store, 
  X, 
  Plus, 
  Minus, 
  Trash2, 
  Edit3, 
  AlertTriangle, 
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  UploadCloud,
  LayoutGrid,
  ListFilter
} from "lucide-react";

// --- CONFIGURACIÓN & TIPOS ---
const SUCURSALES_LISTA = [
  "Centro Isidro Huarte 1",
  "Centro Isidro Huarte 2",
  "Santiago Tapia",
  "Guadalupe Victoria"
];

interface Variante {
  varianteId: number;
  talla: string;
  color: string;
  stock: number;
  precio: number;
}

// ✅ INTERFAZ CORREGIDA - USA 'id' EN VEZ DE 'productoId'
interface Producto {
  id: number;                    // ✅ CAMBIADO de productoId a id
  nombre: string;
  sku: string;
  categoria: string;
  descripcion: string;
  imagen: string | null;
  sucursal: string;
  talla?: string | null;
  color?: string | null;
  stock?: number;
  precio?: number;
  variantes?: Variante[];
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning';
}

// --- COMPONENTE PRINCIPAL ---
export default function InventarioPage() {
  const { data: session, status } = useSession();
  const user = session?.user as any;
  const rol = String(user?.role || "").toLowerCase();
  const sucursalUsuario = user?.sucursal_nombre;

  // Estados de Datos
  const [productos, setProductos] = useState<Producto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estados de Interfaz
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<{open: boolean, id: number | null}>({open: false, id: null});
  const [busqueda, setBusqueda] = useState("");
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState("");
  const [productoEditandoId, setProductoEditandoId] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const tieneSeleccionManual = useRef(false);

  // Formulario
  const [formData, setFormData] = useState({
    nombre: "",
    sku: "",
    categoria: "",
    descripcion: "",
    talla: "",
    color: "",
    imagen: null as File | null,
    imagenPreview: "",
    stock: 0,
    precio: 0
  });

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
    p.sku?.toLowerCase().includes(busqueda.toLowerCase())
  );

  // --- SINCRONIZACIÓN SUCURSAL ---
 useEffect(() => {
  if (status === "authenticated" && !tieneSeleccionManual.current) {

    if (rol === "admin") {
      const guardada = localStorage.getItem("sucursalActiva");
      setSucursalSeleccionada(
        guardada && SUCURSALES_LISTA.includes(guardada)
          ? guardada
          : SUCURSALES_LISTA[0]
      );
    } else {
      // 👇 EMPLEADO USA SU SUCURSAL REAL DE LA SESIÓN
      if (user?.sucursal_nombre) {
        setSucursalSeleccionada(user.sucursal_nombre);
      } else {
        console.error("Empleado sin sucursal asignada");
      }
    }

  }
}, [status, rol, user]);

  // --- FETCH INVENTARIO - CORREGIDO ---
  const fetchInventario = useCallback(async () => {
    if (!sucursalSeleccionada) return;

    setIsLoading(true);
    try {
      const url = `/api/inventario?sucursal=${encodeURIComponent(sucursalSeleccionada)}&_t=${Date.now()}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { "Cache-Control": "no-store" },
        cache: "no-store" 
      });

      if (!res.ok) throw new Error("Error en la red");
      const data = await res.json();
      
      // ✅ MAPEO CORRECTO - USA 'id' DEL BACKEND
      const productosFormateados = Array.isArray(data) ? data.map((p: any) => ({
        id: p.id || 0,                    // ✅ ID del producto
        nombre: p.nombre || "SIN NOMBRE",
        sku: p.sku || "S/SKU",
        categoria: p.categoria || "S/C",
        descripcion: p.descripcion || "",
        talla: p.talla || null,
        color: p.color || null,
        stock: p.stock || 0,
        precio: p.precio || 0,
        imagen: p.imagen || null,
        sucursal: p.sucursal || sucursalSeleccionada,
        variantes: p.variantes || []
      })) : [];
      
      setProductos(productosFormateados);
    } catch (error) {
      addToast("Error al cargar el inventario.", "error");
      setProductos([]);
    } finally {
      setIsLoading(false);
    }
  }, [sucursalSeleccionada]);

  useEffect(() => {
    fetchInventario();
  }, [fetchInventario]);

  // --- CAMBIO SUCURSAL ---
  const handleCambioSucursal = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevaSuc = e.target.value;
    setProductos([]); 
    setIsLoading(true);
    tieneSeleccionManual.current = true; 
    setSucursalSeleccionada(nuevaSuc);
    
    if (rol === "admin") {
      localStorage.setItem("sucursalActiva", nuevaSuc);
    }
  };

  // --- IMAGEN ---
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        addToast('Formato inválido. Usa JPG, PNG o WEBP.', "warning");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        addToast('La imagen no debe superar los 5MB.', "warning");
        return;
      }
      if (formData.imagenPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(formData.imagenPreview);
      }
      setFormData({
        ...formData,
        imagen: file,
        imagenPreview: URL.createObjectURL(file)
      });
    }
  };

  // --- EDITAR ---
  const handleEdit = (prod: Producto) => {
    setProductoEditandoId(prod.id);  // ✅ USA prod.id
    setFormData({
      nombre: prod.nombre || "",
      sku: prod.sku || "",
      categoria: prod.categoria || "",
      descripcion: prod.descripcion || "",
      talla: prod.talla || "",
      color: prod.color || "",
      imagen: null,
      imagenPreview: prod.imagen || "",
      stock: prod.stock || 0,
      precio: prod.precio || 0
    });
    setIsModalOpen(true);
  };

  // --- ELIMINAR - CORREGIDO ---
  const handleDelete = async () => {
    if (!isDeleteModalOpen.id) {
      addToast("Error: ID de producto no válido", "error");
      return;
    }
    
    try {
      const res = await fetch(`/api/inventario/${isDeleteModalOpen.id}`, { 
        method: "DELETE" 
      });
      
      if (res.ok) {
        setIsDeleteModalOpen({ open: false, id: null });
        fetchInventario();
        addToast("Producto eliminado correctamente.", "success");
      } else {
        const data = await res.json();
        addToast(data.error || "Error al eliminar el producto.", "error");
      }
    } catch (err) { 
      addToast("Error de conexión con el servidor.", "error");
    }
  };

  // --- GUARDAR (CREAR/EDITAR) ---
  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const formDataToSend = new FormData();
    formDataToSend.append('nombre', formData.nombre);
    formDataToSend.append('sku', formData.sku);
    formDataToSend.append('categoria', formData.categoria);
    formDataToSend.append('descripcion', formData.descripcion);
    formDataToSend.append('talla', formData.talla);
    formDataToSend.append('color', formData.color);
    formDataToSend.append('stock', formData.stock.toString());
    formDataToSend.append('precio', formData.precio.toString());
    formDataToSend.append('sucursal', sucursalSeleccionada);
    
    if (formData.imagenPreview && !formData.imagenPreview.startsWith('blob:')) {
      formDataToSend.append('imagen_existente', formData.imagenPreview);
    }
    if (formData.imagen) {
      formDataToSend.append('imagen', formData.imagen);
    }
    if (productoEditandoId) {
      formDataToSend.append('id', productoEditandoId.toString());
    }
    
    const url = productoEditandoId ? '/api/inventario/editar' : '/api/inventario/nuevo';
    
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: formDataToSend
      });

      const data = await res.json();
      
      if (res.ok) {
        setIsModalOpen(false);
        handleNuevoProducto();
        fetchInventario();
        addToast(productoEditandoId ? "Producto actualizado." : "Producto creado.", "success");
      } else {
        addToast(data.error || "Error al guardar el producto.", "error");
      }
    } catch (err) { 
      addToast("Error de conexión con el servidor.", "error");
    }
  };

  // --- UTILERÍAS FORMULARIO ---
  const handleNuevoProducto = () => {
    setProductoEditandoId(null);
    setFormData({ 
      nombre: "", sku: "", categoria: "", descripcion: "", talla: "", color: "",
      imagen: null, imagenPreview: "", stock: 0, precio: 0 
    });
    if(!isModalOpen) setIsModalOpen(true);
  };

  const handleCerrarModal = () => {
    setIsModalOpen(false);
    setProductoEditandoId(null);
    if (formData.imagenPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(formData.imagenPreview);
    }
  };

  // --- RENDERIZADO ---
  if (status === "loading") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-black" />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500 animate-pulse">Cargando Inventario...</span>
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
            <h1 className="text-3xl font-black uppercase tracking-tight text-gray-900">Inventario</h1>
            <p className="text-sm font-medium text-gray-500 mt-1 flex items-center gap-2">
              <Store size={14} />
              Gestión de existencias en tiempo real
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
                  {sucursalSeleccionada || "Seleccione..."}
                </span>
                {rol === "admin" && <CheckCircle2 size={14} className="text-blue-500" />}
              </div>
            </div>
          </div>
        </header>

        {/* CONTROLES */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-1 w-full gap-3">
            {/* Buscador */}
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por nombre, SKU o categoría..."
                className="w-full bg-gray-50 border-none rounded-xl pl-12 pr-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-black/5 transition-all"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            
            {/* Selector Admin */}
            {rol === "admin" && (
              <div className="relative min-w-[200px] hidden md:block">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ListFilter size={18} className="text-gray-400"/>
                </div>
                <select 
                  className="w-full appearance-none bg-gray-50 border-none rounded-xl pl-12 pr-10 py-3 text-sm font-bold text-gray-700 uppercase outline-none focus:ring-2 focus:ring-black/5 cursor-pointer"
                  value={sucursalSeleccionada}
                  onChange={handleCambioSucursal}
                >
                  {SUCURSALES_LISTA.map((suc) => (
                    <option key={suc} value={suc}>{suc}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <button 
            onClick={handleNuevoProducto}
            className="w-full md:w-auto bg-black text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-gray-800 hover:shadow-lg hover:-translate-y-0.5 transition-all active:translate-y-0 active:shadow-none"
          >
            <PackagePlus size={18} />
            <span>Nuevo Producto</span>
          </button>
        </div>

        {/* TABLA DE DATOS */}
        <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th className="px-6 py-5 text-[11px] font-black text-gray-400 uppercase tracking-wider">Producto</th>
                  <th className="px-6 py-5 text-[11px] font-black text-gray-400 uppercase tracking-wider text-center">SKU</th>
                  <th className="px-6 py-5 text-[11px] font-black text-gray-400 uppercase tracking-wider text-center">Detalles</th>
                  <th className="px-6 py-5 text-[11px] font-black text-gray-400 uppercase tracking-wider text-center">Stock</th>
                  <th className="px-6 py-5 text-[11px] font-black text-gray-400 uppercase tracking-wider text-center">Precio</th>
                  <th className="px-6 py-5 text-[11px] font-black text-gray-400 uppercase tracking-wider text-right">Gestión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-6 py-8">
                        <div className="h-10 bg-gray-100 rounded-xl w-full"></div>
                      </td>
                    </tr>
                  ))
                ) : productosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-24 text-center">
                      <div className="flex flex-col items-center justify-center opacity-40">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                          <PackagePlus size={32} />
                        </div>
                        <p className="text-sm font-bold uppercase tracking-wider text-gray-500">Sin resultados</p>
                        <p className="text-xs text-gray-400 mt-1">No hay productos que coincidan con tu búsqueda</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  productosFiltrados.map((prod) => (
                    <tr key={prod.id} className="group hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-white rounded-xl overflow-hidden flex-shrink-0 border border-gray-100 shadow-sm relative group-hover:border-gray-300 transition-colors">
                            {prod.imagen ? (
                              <img 
                                src={prod.imagen} 
                                alt={prod.nombre}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=IMG' }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <ImageIcon size={20} />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900 uppercase leading-snug">
                              {prod.nombre}
                            </span>
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide bg-gray-100 px-2 py-0.5 rounded-md w-fit mt-1">
                              {prod.categoria}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-xs font-mono font-medium text-gray-600 bg-white border border-gray-200 px-2 py-1 rounded">
                          {prod.sku}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                            Talla: <span className="text-gray-900">{prod.talla || '-'}</span>
                          </span>
                          <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                            Color: <span className="text-gray-900">{prod.color || '-'}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          (prod.stock || 0) <= 2 
                            ? 'bg-red-50 text-red-600 border border-red-100' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}>
                          {(prod.stock || 0) <= 2 && <AlertTriangle size={12} />}
                          {prod.stock || 0} Unid.
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-gray-900 text-sm">
                        ${Number(prod.precio || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEdit(prod)} 
                            className="p-2 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-black hover:border-black transition-all shadow-sm"
                            title="Editar"
                          >
                            <Edit3 size={16}/>
                          </button>
                          <button 
                            onClick={() => setIsDeleteModalOpen({open: true, id: prod.id})} 
                            className="p-2 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-red-500 hover:border-red-500 transition-all shadow-sm"
                            title="Eliminar"
                          >
                            <Trash2 size={16}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
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

      {/* --- MODAL ELIMINAR --- */}
      {isDeleteModalOpen.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsDeleteModalOpen({open: false, id: null})}></div>
          <div className="relative bg-white p-8 rounded-[2rem] max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h2 className="text-xl font-black uppercase text-gray-900">¿Eliminar producto?</h2>
            <p className="text-sm text-gray-500 mt-2 mb-8">Esta acción borrará el registro permanentemente.</p>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setIsDeleteModalOpen({open: false, id: null})} 
                className="py-3 bg-gray-100 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-500 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDelete} 
                className="py-3 bg-red-500 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-red-600 transition-colors"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL REGISTRO/EDICIÓN --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md transition-opacity" onClick={handleCerrarModal}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-5 duration-300 max-h-[90vh] flex flex-col">
            
            {/* Header Modal */}
            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-white z-10 shrink-0">
              <div>
                <h2 className="text-2xl font-black uppercase text-gray-900 tracking-tight flex items-center gap-2">
                  {productoEditandoId ? <Edit3 size={24}/> : <LayoutGrid size={24}/>}
                  {productoEditandoId ? 'Editar Prenda' : 'Nuevo Ingreso'}
                </h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                  {sucursalSeleccionada} 
                </p>
              </div>
              <button onClick={handleCerrarModal} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 hover:text-black transition-all">
                <X size={24}/>
              </button>
            </div>
            
            {/* Form Scrollable */}
            <div className="overflow-y-auto p-8 custom-scrollbar">
              <form onSubmit={handleGuardar} className="space-y-6">
                
                {/* Bloque 1: Imagen Principal */}
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="w-full sm:w-1/3">
                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 ml-1">Fotografía</label>
                    <div className="relative aspect-square w-full">
                      {formData.imagenPreview ? (
                        <div className="relative h-full w-full rounded-2xl overflow-hidden border border-gray-200 group">
                          <img src={formData.imagenPreview} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setFormData({...formData, imagen: null, imagenPreview: ""})}
                            className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-full border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-black hover:bg-gray-50 transition-all text-gray-400 hover:text-black">
                          <UploadCloud size={32} strokeWidth={1.5} className="mb-2"/>
                          <span className="text-[10px] font-bold uppercase">Subir Imagen</span>
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Bloque 2: Información Básica */}
                  <div className="w-full sm:w-2/3 space-y-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Nombre del Artículo</label>
                      <input 
                        required 
                        type="text" 
                        className="w-full mt-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-black/5 transition-all"
                        placeholder="Ej: CAMISA LINO BLANCA"
                        value={formData.nombre} 
                        onChange={(e) => setFormData({...formData, nombre: e.target.value.toUpperCase()})}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">SKU</label>
                        <input 
                          required 
                          type="text" 
                          className="w-full mt-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-black/5"
                          value={formData.sku} 
                          onChange={(e) => setFormData({...formData, sku: e.target.value.toUpperCase()})}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Categoría</label>
                        <input 
                          required 
                          type="text" 
                          className="w-full mt-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-black/5"
                          value={formData.categoria} 
                          onChange={(e) => setFormData({...formData, categoria: e.target.value.toUpperCase()})}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Descripción (Opcional)</label>
                      <textarea 
                        className="w-full mt-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-black/5 resize-none h-20"
                        value={formData.descripcion} 
                        onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-gray-100 w-full"></div>

                {/* Bloque 3: Detalles y Stock */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Izquierda: Atributos */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Talla</label>
                        <input 
                          type="text" 
                          className="w-full mt-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-black/5"
                          value={formData.talla} 
                          onChange={(e) => setFormData({...formData, talla: e.target.value.toUpperCase()})} 
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Color</label>
                        <input 
                          type="text" 
                          className="w-full mt-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-black/5"
                          value={formData.color} 
                          onChange={(e) => setFormData({...formData, color: e.target.value.toUpperCase()})} 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Derecha: Valores */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Stock</label>
                        <div className="flex items-center mt-1 bg-gray-50 rounded-xl overflow-hidden border border-transparent focus-within:border-black/10 focus-within:bg-white transition-all">
                          <button 
                            type="button" 
                            onClick={() => setFormData({...formData, stock: Math.max(0, formData.stock - 1)})} 
                            className="px-3 py-3 text-gray-400 hover:text-black hover:bg-gray-100 transition-colors"
                          >
                            <Minus size={14}/>
                          </button>
                          <input 
                            type="number" 
                            className="w-full bg-transparent text-center text-sm font-black outline-none appearance-none"
                            value={formData.stock} 
                            onChange={(e) => setFormData({...formData, stock: parseInt(e.target.value) || 0})} 
                          />
                          <button 
                            type="button" 
                            onClick={() => setFormData({...formData, stock: formData.stock + 1})} 
                            className="px-3 py-3 text-gray-400 hover:text-black hover:bg-gray-100 transition-colors"
                          >
                            <Plus size={14}/>
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Precio $</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          min="0" 
                          className="w-full mt-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-black/5"
                          value={formData.precio || ""} 
                          onChange={(e) => setFormData({...formData, precio: parseFloat(e.target.value) || 0})} 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer del Formulario */}
                <div className="pt-4">
                  <button 
                    type="submit" 
                    className="w-full bg-black text-white py-4 rounded-xl text-xs font-bold uppercase tracking-[0.2em] shadow-xl hover:bg-gray-900 hover:scale-[1.01] transition-all active:scale-[0.99]"
                  >
                    {productoEditandoId ? 'Guardar Cambios' : 'Registrar Producto'}
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}