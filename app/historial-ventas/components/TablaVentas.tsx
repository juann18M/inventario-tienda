"use client";

import { Eye, Receipt, User, Store, CreditCard, Calendar, Trash2, AlertTriangle, X, Info, ChevronLeft, ChevronRight, Package, DollarSign, Clock, ShoppingBag } from "lucide-react";
import { useState } from "react";

interface Venta {
  id: number;
  fecha: string;
  total: number;
  metodo_pago: string;
  cliente: string | null;
  usuario_nombre: string;
  usuario_rol: string;
  sucursal_nombre: string;
  cantidad_productos: number;
  // Campos para apartados
  es_apartado?: boolean;
  apartado_id?: number;
  cliente_apartado?: string;
  cliente_mostrar?: string;
}

interface Paginacion {
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
}

interface Props {
  ventas: Venta[];
  isLoading: boolean;
  onVerDetalle: (id: number) => void;
  paginacion: Paginacion;
  onCambiarPagina: (pagina: number) => void;
  isAdmin: boolean;
  onRecargar: () => void;
}

// Componente Modal interno - Versión Blanco y Negro
function ModalConfirmacion({
  isOpen,
  titulo,
  mensaje,
  tipo = "peligro",
  confirmarTexto = "Confirmar",
  cancelarTexto = "Cancelar",
  onConfirmar,
  onCancelar,
  isLoading = false
}: {
  isOpen: boolean;
  titulo: string;
  mensaje: string;
  tipo?: "peligro" | "exito" | "info";
  confirmarTexto?: string;
  cancelarTexto?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
  isLoading?: boolean;
}) {
  if (!isOpen) return null;

  const tipoConfig = {
    peligro: {
      icon: AlertTriangle,
      iconColor: "text-gray-700",
      bgColor: "bg-gray-50",
      borderColor: "border-gray-200",
      buttonColor: "bg-gray-900 hover:bg-gray-800",
      buttonText: "text-white"
    },
    exito: {
      icon: Info,
      iconColor: "text-gray-700",
      bgColor: "bg-gray-50",
      borderColor: "border-gray-200",
      buttonColor: "bg-gray-900 hover:bg-gray-800",
      buttonText: "text-white"
    },
    info: {
      icon: Info,
      iconColor: "text-gray-700",
      bgColor: "bg-gray-50",
      borderColor: "border-gray-200",
      buttonColor: "bg-gray-900 hover:bg-gray-800",
      buttonText: "text-white"
    }
  };

  const config = tipoConfig[tipo];
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className={`px-5 py-4 border-b border-gray-200 bg-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Icon className={`h-5 w-5 ${config.iconColor}`} />
              </div>
              <h3 className="text-base font-bold text-gray-900 uppercase tracking-tight">{titulo}</h3>
            </div>
            <button
              onClick={onCancelar}
              disabled={isLoading}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Mensaje */}
        <div className="px-5 py-5">
          <div className="mb-5">
            <p className="text-sm text-gray-600 whitespace-pre-line">{mensaje}</p>
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            {cancelarTexto && (
              <button
                onClick={onCancelar}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {cancelarTexto}
              </button>
            )}
            <button
              onClick={onConfirmar}
              disabled={isLoading}
              className={`flex-1 px-4 py-2.5 ${config.buttonColor} ${config.buttonText} text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Procesando...</span>
                </div>
              ) : (
                confirmarTexto
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente Modal para eliminación masiva - Versión Blanco y Negro
function ModalEliminarMasivo({
  isOpen,
  onClose,
  onConfirmar,
  isLoading
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirmar: (sucursalId: number, fecha?: string) => void;
  isLoading: boolean;
}) {
  const [sucursalId, setSucursalId] = useState("");
  const [fecha, setFecha] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    setError("");
    
    if (!sucursalId.trim()) {
      setError("Selecciona una sucursal");
      return;
    }

    const id = parseInt(sucursalId);
    if (isNaN(id) || id < 1 || id > 4) {
      setError("ID de sucursal inválido");
      return;
    }

    if (fecha.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      setError("Formato de fecha inválido. Usa YYYY-MM-DD");
      return;
    }

    onConfirmar(id, fecha.trim() || undefined);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-gray-700" />
              </div>
              <h3 className="text-base font-bold text-gray-900 uppercase tracking-tight">Eliminación Masiva</h3>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="px-5 py-5">
          {error && (
            <div className="mb-4 p-3 bg-gray-100 border border-gray-200 rounded-lg">
              <p className="text-gray-700 text-xs font-medium">{error}</p>
            </div>
          )}

          <div className="space-y-4 mb-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Sucursal <span className="text-gray-900">*</span>
              </label>
              <select
                value={sucursalId}
                onChange={(e) => setSucursalId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition-all"
                disabled={isLoading}
              >
                <option value="">Selecciona sucursal</option>
                <option value="1">1 - Centro Isidro Huarte 1</option>
                <option value="2">2 - Centro Isidro Huarte 2</option>
                <option value="3">3 - Santiago Tapia</option>
                <option value="4">4 - Guadalupe Victoria</option>
              </select>
              <p className="text-[10px] text-gray-500 mt-1.5">
                * Eliminará todas las ventas de esta sucursal
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Fecha específica <span className="text-gray-400">(Opcional)</span>
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition-all"
                disabled={isLoading}
              />
              <p className="text-[10px] text-gray-500 mt-1.5">
                Si especificas fecha, solo eliminará ventas de ese día
              </p>
            </div>

            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-gray-600" />
                Esta acción NO se puede deshacer
              </p>
              <p className="text-[10px] text-gray-500 mt-1">
                Todas las ventas seleccionadas serán eliminadas permanentemente del sistema.
              </p>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Procesando...
                </div>
              ) : (
                "Eliminar Ventas"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TablaVentas({
  ventas,
  isLoading,
  onVerDetalle,
  paginacion,
  onCambiarPagina,
  isAdmin,
  onRecargar
}: Props) {
  const [eliminando, setEliminando] = useState<number | null>(null);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);
  const [modalEliminar, setModalEliminar] = useState<number | null>(null);
  const [modalMasivo, setModalMasivo] = useState(false);
  const [modalResultado, setModalResultado] = useState<{
    tipo: 'exito' | 'peligro' | 'info';
    mensaje: string;
  } | null>(null);
  
  const formatFecha = (fecha: string) => {
    const date = new Date(fecha);
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMetodoPagoColor = (metodo: string, esApartado?: boolean) => {
    if (esApartado || metodo === 'APARTADO') {
      return 'bg-purple-100 text-purple-800 border border-purple-200';
    }
    switch (metodo) {
      case 'Efectivo':
        return 'bg-gray-100 text-gray-800 border border-gray-200';
      case 'Tarjeta':
        return 'bg-gray-100 text-gray-800 border border-gray-200';
      case 'Transferencia':
        return 'bg-gray-100 text-gray-800 border border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const getUsuarioRolColor = (rol: string) => {
    switch (rol.toLowerCase()) {
      case 'admin':
        return 'bg-gray-800 text-white border border-gray-700';
      case 'empleado':
        return 'bg-gray-200 text-gray-800 border border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const handleEliminarVenta = (ventaId: number) => {
    setModalEliminar(ventaId);
  };

  const handleConfirmarEliminar = async () => {
    if (!modalEliminar) return;

    setEliminando(modalEliminar);
    setErrorEliminar(null);

    try {
      const res = await fetch(`/api/historial/eliminar?id=${modalEliminar}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await res.json();

      if (data.success) {
        setModalResultado({
          tipo: 'exito',
          mensaje: `Venta #${modalEliminar} eliminada del sistema exitosamente.`
        });
        onRecargar();
      } else {
        setModalResultado({
          tipo: 'peligro',
          mensaje: data.error || "Error al eliminar la venta"
        });
      }
    } catch (error: any) {
      setModalResultado({
        tipo: 'peligro',
        mensaje: "Error de conexión con el servidor. Intente nuevamente."
      });
    } finally {
      setEliminando(null);
      setModalEliminar(null);
    }
  };

  const handleEliminarTodas = () => {
    if (!isAdmin) return;
    setModalMasivo(true);
  };

  const handleEliminarMasivoConfirmar = async (sucursalId: number, fecha?: string) => {
    setEliminando(-1);
    setErrorEliminar(null);

    try {
      let url = `/api/historial/eliminar?eliminarTodo=true&sucursalId=${sucursalId}`;
      if (fecha) {
        url += `&fecha=${fecha}`;
      }

      const res = await fetch(url, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await res.json();

      if (data.success) {
        setModalResultado({
          tipo: 'exito',
          mensaje: `${data.resultado?.eliminadas || data.eliminadas || 0} ventas eliminadas del sistema exitosamente.`
        });
        onRecargar();
      } else {
        setModalResultado({
          tipo: 'peligro',
          mensaje: data.error || "Error al eliminar las ventas"
        });
      }
    } catch (error: any) {
      setModalResultado({
        tipo: 'peligro',
        mensaje: "Error de conexión con el servidor. Intente nuevamente."
      });
    } finally {
      setEliminando(null);
      setModalMasivo(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 md:p-16 text-center">
        <div className="inline-flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full border-2 border-gray-200"></div>
            <div className="h-10 w-10 rounded-full border-2 border-gray-900 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Cargando historial</p>
        </div>
      </div>
    );
  }

  if (ventas.length === 0) {
    return (
      <div className="p-12 md:p-16 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Receipt className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2 uppercase tracking-tight">No hay ventas registradas</h3>
          <p className="text-sm text-gray-500">
            {isAdmin 
              ? "No se encontraron ventas con los filtros aplicados. Intenta cambiar los criterios de búsqueda."
              : "Aún no tienes ventas registradas. Comienza a realizar ventas para verlas aquí."
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Botón Eliminar Todo (solo admin) */}
      {isAdmin && ventas.length > 0 && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 text-gray-700">
              <AlertTriangle size={16} className="flex-shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider">Acciones administrativas</span>
            </div>
            <button
              onClick={handleEliminarTodas}
              disabled={eliminando === -1}
              className="w-full sm:w-auto px-4 py-2 bg-gray-900 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 size={14} />
              {eliminando === -1 ? "Eliminando..." : "Eliminar Ventas Masivo"}
            </button>
          </div>
          {errorEliminar && (
            <div className="mt-3 p-2 bg-gray-100 border border-gray-200 rounded text-gray-700 text-xs">
              Error: {errorEliminar}
            </div>
          )}
        </div>
      )}

      {/* Vista Móvil: Cards */}
      <div className="block md:hidden divide-y divide-gray-200">
        {ventas.map((venta) => {
          const esApartado = venta.es_apartado || venta.metodo_pago === 'APARTADO';
          const clienteMostrar = venta.cliente_mostrar || venta.cliente_apartado || venta.cliente;
          
          return (
            <div key={venta.id} className="p-4 hover:bg-gray-50 transition-colors">
              {/* Header Card */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    {esApartado ? (
                      <ShoppingBag className="h-5 w-5 text-purple-600" />
                    ) : (
                      <Receipt className="h-5 w-5 text-gray-600" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">#{venta.id}</span>
                      {esApartado && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 font-medium">
                          APARTADO
                        </span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getMetodoPagoColor(venta.metodo_pago, esApartado)}`}>
                        {venta.metodo_pago === 'APARTADO' ? 'Liquidación' : venta.metodo_pago}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5">
                      <Calendar size={10} />
                      <span>{new Date(venta.fecha).toLocaleDateString('es-MX')}</span>
                      <Clock size={10} className="ml-1" />
                      <span>{new Date(venta.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {esApartado && venta.apartado_id && (
                      <div className="text-[9px] text-purple-600 mt-0.5 font-medium">
                        Apartado #{venta.apartado_id}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">
                    ${(venta.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Detalles Card */}
              <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                <div className="bg-gray-50 p-2 rounded-lg">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Sucursal</p>
                  <p className="font-medium text-gray-900 truncate">{venta.sucursal_nombre}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded-lg">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Productos</p>
                  <p className="font-medium text-gray-900">{venta.cantidad_productos} {venta.cantidad_productos === 1 ? 'unidad' : 'unidades'}</p>
                </div>
                {isAdmin && (
                  <div className="bg-gray-50 p-2 rounded-lg">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Vendedor</p>
                    <p className="font-medium text-gray-900 truncate">{venta.usuario_nombre}</p>
                  </div>
                )}
                <div className="bg-gray-50 p-2 rounded-lg">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Cliente</p>
                  <p className="font-medium text-gray-900 truncate">{clienteMostrar || 'Sin cliente'}</p>
                </div>
              </div>

              {/* Acciones Card */}
              <div className="flex gap-2">
                <button
                  onClick={() => onVerDetalle(venta.id)}
                  className="flex-1 px-3 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Eye size={14} />
                  Ver detalle
                </button>
                
                {isAdmin && (
                  <button
                    onClick={() => handleEliminarVenta(venta.id)}
                    disabled={eliminando === venta.id}
                    className="flex-1 px-3 py-2 bg-white border border-gray-300 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    {eliminando === venta.id ? "Eliminando..." : "Eliminar"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Vista Desktop: Tabla */}
      <div className="hidden md:block overflow-x-auto">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} />
                    Fecha
                  </div>
                </th>
                {isAdmin && (
                  <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-1.5">
                      <User size={12} />
                      Vendedor
                    </div>
                  </th>
                )}
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <Store size={12} />
                    Sucursal
                  </div>
                </th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <Package size={12} />
                    Productos
                  </div>
                </th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <CreditCard size={12} />
                    Pago
                  </div>
                </th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <DollarSign size={12} />
                    Total
                  </div>
                </th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {ventas.map((venta) => {
                const esApartado = venta.es_apartado || venta.metodo_pago === 'APARTADO';
                const clienteMostrar = venta.cliente_mostrar || venta.cliente_apartado || venta.cliente;
                
                return (
                  <tr key={venta.id} className="hover:bg-gray-50/80 transition-colors">
                    {/* Fecha */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                          {esApartado ? (
                            <ShoppingBag className="h-4 w-4 text-purple-600" />
                          ) : (
                            <Calendar className="h-4 w-4 text-gray-600" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-medium text-gray-900">
                            {new Date(venta.fecha).toLocaleDateString('es-MX', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {new Date(venta.fecha).toLocaleTimeString('es-MX', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          {esApartado && venta.apartado_id && (
                            <div className="text-[9px] text-purple-600 font-medium mt-0.5">
                              #{venta.apartado_id}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    
                    {/* Vendedor (solo admin) */}
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center mr-2">
                            <User className="h-4 w-4 text-gray-600" />
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-900">
                              {venta.usuario_nombre}
                            </div>
                            <div className="mt-0.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${getUsuarioRolColor(venta.usuario_rol)}`}>
                                {venta.usuario_rol}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                    )}
                    
                    {/* Sucursal */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center mr-2">
                          <Store className="h-4 w-4 text-gray-600" />
                        </div>
                        <span className="text-xs font-medium text-gray-900">
                          {venta.sucursal_nombre}
                        </span>
                      </div>
                    </td>
                    
                    {/* Cliente */}
                    <td className="px-6 py-4">
                      <div className="text-xs text-gray-900 max-w-[150px]">
                        {clienteMostrar ? (
                          <div className="flex items-center">
                            <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                              <span className="text-[10px] font-bold text-gray-700 uppercase">
                                {clienteMostrar.charAt(0)}
                              </span>
                            </div>
                            <span className="truncate">{clienteMostrar}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-[10px]">Sin cliente</span>
                        )}
                      </div>
                    </td>
                    
                    {/* Productos */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center mr-2">
                          <span className="text-xs font-bold text-gray-700">
                            {venta.cantidad_productos}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {venta.cantidad_productos === 1 ? 'unidad' : 'unidades'}
                        </span>
                      </div>
                    </td>
                    
                    {/* Método de Pago */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] font-medium ${getMetodoPagoColor(venta.metodo_pago, esApartado)}`}>
                          {esApartado ? 'APARTADO' : venta.metodo_pago}
                        </span>
                        {esApartado && (
                          <span className="text-[9px] text-purple-600 font-medium">
                            Liquidación
                          </span>
                        )}
                      </div>
                    </td>
                    
                    {/* Total */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">
                        ${(venta.total || 0).toLocaleString('es-MX', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {venta.cantidad_productos > 0 && venta.total > 0
                          ? `$${(venta.total / venta.cantidad_productos).toLocaleString('es-MX', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0
                            })} c/u`
                          : '—'}
                      </div>
                    </td>
                    
                    {/* Acciones */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => onVerDetalle(venta.id)}
                          className="p-1.5 bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
                          title="Ver detalle"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        
                        {isAdmin && (
                          <button
                            onClick={() => handleEliminarVenta(venta.id)}
                            disabled={eliminando === venta.id}
                            className="p-1.5 bg-white border border-gray-300 text-red-500 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50"
                            title="Eliminar"
                          >
                            {eliminando === venta.id ? (
                              <div className="h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación Responsive */}
      {paginacion.totalPaginas > 1 && (
        <div className="px-4 md:px-6 py-4 border-t border-gray-200 bg-gray-50/50 rounded-b-xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-[10px] md:text-xs text-gray-500 order-2 sm:order-1">
              <span className="font-medium text-gray-700">{paginacion.total}</span> ventas en total
              <span className="hidden sm:inline"> · Página {paginacion.pagina} de {paginacion.totalPaginas}</span>
            </div>
            
            <div className="flex items-center gap-2 order-1 sm:order-2">
              <button
                onClick={() => onCambiarPagina(paginacion.pagina - 1)}
                disabled={paginacion.pagina === 1}
                className="px-3 py-1.5 md:px-4 md:py-2 border border-gray-300 text-xs font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Anterior</span>
              </button>
              
              <div className="hidden md:flex items-center gap-1">
                {Array.from({ length: Math.min(5, paginacion.totalPaginas) }, (_, i) => {
                  let pageNum = i + 1;
                  if (paginacion.pagina > 3) {
                    pageNum = paginacion.pagina - 2 + i;
                  }
                  if (pageNum <= paginacion.totalPaginas) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => onCambiarPagina(pageNum)}
                        className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
                          paginacion.pagina === pageNum
                            ? 'bg-gray-900 text-white'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                  return null;
                })}
              </div>
              
              <div className="md:hidden text-xs font-medium text-gray-700 px-2">
                {paginacion.pagina} / {paginacion.totalPaginas}
              </div>
              
              <button
                onClick={() => onCambiarPagina(paginacion.pagina + 1)}
                disabled={paginacion.pagina === paginacion.totalPaginas}
                className="px-3 py-1.5 md:px-4 md:py-2 border border-gray-300 text-xs font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                <span className="hidden sm:inline">Siguiente</span>
                <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />
              </button>
            </div>
            
            <div className="text-[10px] text-gray-400 order-3 sm:order-3">
              {paginacion.limite} por página
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar venta */}
      <ModalConfirmacion
        isOpen={modalEliminar !== null}
        titulo="Eliminar Venta"
        mensaje={`¿Está seguro de eliminar permanentemente la venta #${modalEliminar}?\n\nEsta acción NO se puede deshacer y los datos serán eliminados del sistema.`}
        tipo="peligro"
        confirmarTexto="Eliminar"
        cancelarTexto="Cancelar"
        onConfirmar={() => handleConfirmarEliminar()}
        onCancelar={() => setModalEliminar(null)}
        isLoading={eliminando === modalEliminar}
      />

      {/* Modal de eliminación masiva */}
      <ModalEliminarMasivo
        isOpen={modalMasivo}
        onClose={() => setModalMasivo(false)}
        onConfirmar={handleEliminarMasivoConfirmar}
        isLoading={eliminando === -1}
      />

      {/* Modal de resultado */}
      <ModalConfirmacion
        isOpen={modalResultado !== null}
        titulo={modalResultado?.tipo === 'exito' ? 'Operación Exitosa' : 'Error'}
        mensaje={modalResultado?.mensaje || ''}
        tipo={modalResultado?.tipo || 'info'}
        confirmarTexto="Aceptar"
        cancelarTexto=""
        onConfirmar={() => setModalResultado(null)}
        onCancelar={() => setModalResultado(null)}
      />
    </>
  );
}