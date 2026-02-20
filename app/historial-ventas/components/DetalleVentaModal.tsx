"use client";

import { useState, useEffect } from "react";
import { 
  X, 
  Package, 
  DollarSign, 
  Calendar, 
  User, 
  Building,
  CreditCard, 
  Tag,
  Palette,
  Ruler,
  FileText,
  ShoppingBag,
  Receipt,
  Hash,
  Layers,
  CheckCircle,
  Printer,
  Download,
  Copy,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus
} from "lucide-react";

interface DetalleProducto {
  id: number;
  variante_id: number;
  producto_nombre: string;
  producto_sku: string;
  producto_categoria: string;
  talla: string;
  color: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  descripcion: string;
}

interface VentaDetalle {
  id: number;
  fecha: string;
  total: number;
  metodo_pago: string;
  cliente: string;
  observaciones: string;
  usuario_nombre: string;
  usuario_rol: string;
  sucursal_nombre: string;
  productos: DetalleProducto[];
}

interface Props {
  ventaId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function DetalleVentaModal({ ventaId, isOpen, onClose }: Props) {
  const [detalle, setDetalle] = useState<VentaDetalle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'productos' | 'resumen'>('productos');

  useEffect(() => {
    if (ventaId && isOpen) {
      cargarDetalle();
    } else {
      setDetalle(null);
      setError(null);
      setCopied(false);
      setActiveTab('productos');
    }
  }, [ventaId, isOpen]);

  const cargarDetalle = async () => {
    if (!ventaId) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/historial/${ventaId}`);
      const data = await res.json();
      
      if (data.success) {
        setDetalle(data.venta);
      } else {
        setError(data.error || "Error al cargar los detalles");
      }
    } catch (error) {
      console.error("Error cargando detalle:", error);
      setError("Error de conexión con el servidor");
    } finally {
      setIsLoading(false);
    }
  };

  const getMetodoPagoColor = (metodo: string) => {
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

  const getRolColor = (rol: string) => {
    switch (rol.toLowerCase()) {
      case 'admin':
        return 'bg-gray-800 text-white border border-gray-700';
      case 'empleado':
        return 'bg-gray-200 text-gray-800 border border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const copiarIdVenta = () => {
    if (detalle) {
      navigator.clipboard.writeText(detalle.id.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const imprimirDetalle = () => {
    window.print();
  };

  const formatFechaCompleta = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFechaCorta = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatMoneda = (monto: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(monto);
  };

  const calcularTotalProductos = () => {
    if (!detalle) return 0;
    return detalle.productos.reduce((total, producto) => total + producto.cantidad, 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl sm:rounded-2xl w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Header - Compacto y responsivo */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <div className="p-2 sm:p-2.5 bg-gray-100 rounded-lg sm:rounded-xl flex-shrink-0">
              <Receipt className="h-5 w-5 sm:h-6 sm:w-6 text-gray-700" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 uppercase tracking-tight truncate">
                Detalle de Venta
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1 truncate">
                  <Building size={12} className="flex-shrink-0" />
                  <span className="truncate">{detalle?.sucursal_nombre || "Cargando..."}</span>
                </span>
                {detalle && (
                  <button
                    onClick={copiarIdVenta}
                    className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-400 hover:text-gray-900 transition-colors flex-shrink-0"
                  >
                    <Hash size={10} className="sm:w-3 sm:h-3" />
                    <span className="hidden xs:inline">#{detalle.id}</span>
                    <span className="xs:hidden">{detalle.id}</span>
                    <Copy size={10} className={`sm:w-3 sm:h-3 ${copied ? "text-gray-900" : ""}`} />
                  </button>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={imprimirDetalle}
              className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Imprimir"
            >
              <Printer size={16} className="sm:w-5 sm:h-5 text-gray-600" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={18} className="sm:w-5 sm:h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Contenido Scrollable */}
        <div className="overflow-y-auto p-4 sm:p-6 max-h-[calc(95vh-120px)] sm:max-h-[calc(90vh-140px)] bg-gray-50/30">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 sm:py-16">
              <div className="relative">
                <div className="absolute inset-0 rounded-full border-2 border-gray-200"></div>
                <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full border-2 border-gray-900 border-t-transparent animate-spin"></div>
              </div>
              <p className="mt-4 text-sm font-medium text-gray-500 uppercase tracking-wider">Cargando detalles</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 sm:py-16">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10 text-gray-500" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">Error al cargar</h3>
              <p className="text-xs sm:text-sm text-gray-500 mb-6 text-center max-w-md px-4">{error}</p>
              <button
                onClick={cargarDetalle}
                className="px-4 py-2 sm:px-6 sm:py-2.5 bg-gray-900 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                Reintentar
              </button>
            </div>
          ) : detalle ? (
            <>
              {/* Tarjetas de información - Grid responsivo */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                {/* Fecha */}
                <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2">
                    <div className="p-1.5 sm:p-2 bg-gray-100 rounded-lg">
                      <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
                    </div>
                    <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">Fecha</h3>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-xs sm:text-sm font-medium text-gray-900">
                      {new Date(detalle.fecha).toLocaleDateString('es-MX')}
                    </p>
                    <p className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Clock size={10} />
                      {new Date(detalle.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                {/* Vendedor */}
                <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2">
                    <div className="p-1.5 sm:p-2 bg-gray-100 rounded-lg">
                      <User className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
                    </div>
                    <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">Vendedor</h3>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{detalle.usuario_nombre}</p>
                    <span className={`inline-flex w-fit px-2 py-0.5 rounded text-[10px] font-medium ${getRolColor(detalle.usuario_rol)}`}>
                      {detalle.usuario_rol}
                    </span>
                  </div>
                </div>

                {/* Método Pago */}
                <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2">
                    <div className="p-1.5 sm:p-2 bg-gray-100 rounded-lg">
                      <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
                    </div>
                    <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">Pago</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getMetodoPagoColor(detalle.metodo_pago)}`}>
                      {detalle.metodo_pago}
                    </span>
                  </div>
                </div>

                {/* Total */}
                <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200 shadow-sm col-span-2 lg:col-span-1">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2">
                    <div className="p-1.5 sm:p-2 bg-gray-100 rounded-lg">
                      <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
                    </div>
                    <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">Total</h3>
                  </div>
                  <p className="text-base sm:text-lg md:text-xl font-bold text-gray-900">
                    {formatMoneda(detalle.total)}
                  </p>
                </div>
              </div>

              {/* Cliente y Observaciones */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 sm:mb-8">
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <User size={14} className="text-gray-600" />
                    Cliente
                  </h3>
                  <div className={`p-3 rounded-lg ${detalle.cliente ? 'bg-gray-50' : 'bg-gray-100'}`}>
                    <p className={`text-sm sm:text-base ${detalle.cliente ? 'font-medium text-gray-900' : 'text-gray-400 italic'}`}>
                      {detalle.cliente || "Sin cliente registrado"}
                    </p>
                  </div>
                </div>

                {detalle.observaciones && (
                  <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <FileText size={14} className="text-gray-600" />
                      Observaciones
                    </h3>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700 whitespace-pre-line">{detalle.observaciones}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Tabs para móvil */}
              <div className="lg:hidden mb-4">
                <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setActiveTab('productos')}
                    className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                      activeTab === 'productos'
                        ? 'bg-gray-900 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Productos ({detalle.productos.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('resumen')}
                    className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                      activeTab === 'resumen'
                        ? 'bg-gray-900 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Resumen
                  </button>
                </div>
              </div>

              {/* Productos - Vista Desktop (siempre visible) */}
              <div className={`${activeTab === 'productos' ? 'block' : 'hidden lg:block'} mb-6`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Package className="h-5 w-5 text-gray-700" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-gray-900 uppercase tracking-tight">
                        Productos Vendidos
                      </h3>
                      <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                        {detalle.productos.length} {detalle.productos.length === 1 ? 'producto' : 'productos'} • {calcularTotalProductos()} unidades
                      </p>
                    </div>
                  </div>
                </div>

                {/* Cards de productos para móvil */}
                <div className="lg:hidden space-y-3">
                  {detalle.productos.map((producto, index) => (
                    <div key={producto.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <ShoppingBag className="h-5 w-5 text-gray-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-bold text-gray-900 truncate">{producto.producto_nombre}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">{producto.producto_sku}</p>
                            </div>
                            <span className="text-xs font-bold text-gray-900">
                              {formatMoneda(producto.subtotal)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-gray-50 p-2 rounded-lg">
                          <p className="text-[8px] text-gray-500 uppercase">Talla</p>
                          <p className="text-xs font-medium text-gray-900">{producto.talla}</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-lg">
                          <p className="text-[8px] text-gray-500 uppercase">Color</p>
                          <p className="text-xs font-medium text-gray-900">{producto.color}</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-lg">
                          <p className="text-[8px] text-gray-500 uppercase">Cantidad</p>
                          <p className="text-xs font-bold text-gray-900">{producto.cantidad}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-gray-500 border-t border-gray-100 pt-2">
                        <span>Precio unitario: {formatMoneda(producto.precio_unitario)}</span>
                        <span>#{index + 1}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tabla de productos para desktop */}
                <div className="hidden lg:block overflow-x-auto">
                  <div className="inline-block min-w-full align-middle">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Producto</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Variante</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Cantidad</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Precio</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {detalle.productos.map((producto) => (
                          <tr key={producto.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <ShoppingBag className="h-4 w-4 text-gray-600" />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-gray-900">{producto.producto_nombre}</p>
                                  <p className="text-[10px] text-gray-500">{producto.producto_sku}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                <p className="text-[10px] text-gray-600">Talla: {producto.talla}</p>
                                <p className="text-[10px] text-gray-600">Color: {producto.color}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center justify-center w-8 h-8 bg-gray-100 rounded-lg text-xs font-bold text-gray-900">
                                {producto.cantidad}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-xs font-medium text-gray-900">{formatMoneda(producto.precio_unitario)}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm font-bold text-gray-900">{formatMoneda(producto.subtotal)}</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Resumen Final - Vista móvil en tab, siempre visible en desktop */}
              <div className={`${activeTab === 'resumen' ? 'block' : 'hidden lg:block'}`}>
                <div className="bg-gray-900 rounded-xl p-4 sm:p-6 text-white">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                        <Layers size={14} />
                        Productos
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-300">Diferentes:</span>
                          <span className="font-semibold text-white">{detalle.productos.length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-300">Unidades:</span>
                          <span className="font-semibold text-white">{calcularTotalProductos()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                        <DollarSign size={14} />
                        Montos
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-300">Subtotal:</span>
                          <span className="font-semibold text-white">
                            {formatMoneda(detalle.productos.reduce((sum, p) => sum + p.subtotal, 0))}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-300">Total:</span>
                          <span className="text-lg font-bold text-white">
                            {formatMoneda(detalle.total)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="sm:col-span-2 lg:col-span-1 flex items-center justify-center sm:justify-start lg:justify-center">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full">
                        <CheckCircle size={14} className="text-gray-300" />
                        <span className="text-xs font-medium text-white">Venta Completada</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-gray-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-[10px] sm:text-xs text-gray-500 order-2 sm:order-1">
              {detalle && (
                <span>Venta #{detalle.id} • {formatFechaCorta(detalle.fecha)}</span>
              )}
            </div>
            <div className="flex gap-2 w-full sm:w-auto order-1 sm:order-2">
              <button
                onClick={cargarDetalle}
                className="flex-1 sm:flex-none px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Refrescar
              </button>
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2 sm:px-6 sm:py-2 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}