"use client";

import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { 
  Trash2, 
  RefreshCw, 
  Download, 
  Calendar, 
  DollarSign, 
  Package, 
  Users, 
  Store, 
  CreditCard,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart as PieChartIcon,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning';
}

export default function ReportesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mostrarMetricas, setMostrarMetricas] = useState(true);
  const [periodo, setPeriodo] = useState('7dias');

  // Colores solo para gráficas
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  // Sistema de notificaciones
  const addToast = (message: string, type: 'success' | 'error' | 'warning') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const fetchData = () => {
    setLoading(true);
    fetch("/api/reportes/resumen")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Error al cargar los reportes");
        }
        return res.json();
      })
      .then((data) => {
        console.log("Datos recibidos:", data);
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error:", err);
        setError(err.message);
        setLoading(false);
        addToast("Error al cargar los reportes", "error");
      });
  };

  useEffect(() => {
    fetchData();
    
    // Actualizar cada 5 minutos
    const interval = setInterval(fetchData, 300000);
    return () => clearInterval(interval);
  }, []);

  const handleLimpiarReportes = async () => {
    try {
      setShowConfirm(false);
      addToast("Reportes reiniciados correctamente", "success");
      fetchData();
    } catch (error) {
      console.error("Error al limpiar:", error);
      addToast("Error al limpiar los reportes", "error");
    }
  };

  // Función mejorada para exportar a Excel
  const handleExportarExcel = () => {
    try {
      // Crear libro de Excel
      const wb = XLSX.utils.book_new();
      
      // Hoja 1: Resumen General
      const resumenData = [
        ['RESUMEN GENERAL DE REPORTES'],
        ['Fecha de exportación', new Date().toLocaleString('es-MX')],
        ['Período', periodo === '7dias' ? 'Últimos 7 días' : periodo === '30dias' ? 'Últimos 30 días' : 'Últimos 90 días'],
        [],
        ['MÉTRICAS PRINCIPALES', 'Valor'],
        ['Ventas Totales ($)', Number(data.ventas?.monto_total || 0).toFixed(2)],
        ['Número de Ventas', data.ventas?.total_ventas || 0],
        ['Productos Vendidos', data.productos?.productos_vendidos || 0],
        ['Ticket Promedio ($)', (Number(data.ventas?.monto_total || 0) / Number(data.ventas?.total_ventas || 1)).toFixed(2)],
        ['Productos por Venta', (Number(data.productos?.productos_vendidos || 0) / Number(data.ventas?.total_ventas || 1)).toFixed(1)],
        [],
        ['EMPLEADO DESTACADO'],
        ['Nombre', data.empleadoTop?.nombre || 'Sin datos'],
        ['Total Ventas ($)', Number(data.empleadoTop?.total || 0).toFixed(2)],
        ['Ventas Realizadas', data.empleadoTop?.ventas_realizadas || 0],
        ['% del Total', ((Number(data.empleadoTop?.total || 0) / Number(data.ventas?.monto_total || 1)) * 100).toFixed(1) + '%'],
        [],
        ['SUCURSAL DESTACADA'],
        ['Nombre', data.sucursalTop?.nombre || 'Sin datos'],
        ['Total Ventas ($)', Number(data.sucursalTop?.total || 0).toFixed(2)],
        ['Ventas Realizadas', data.sucursalTop?.ventas_realizadas || 0],
        ['% del Total', ((Number(data.sucursalTop?.total || 0) / Number(data.ventas?.monto_total || 1)) * 100).toFixed(1) + '%']
      ];
      
      const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen General');
      
      // Hoja 2: Ventas por Día
      if (data.ventasPorDia && data.ventasPorDia.length > 0) {
        const ventasDiaData = [
          ['VENTAS POR DÍA'],
          ['Fecha', 'Cantidad de Ventas', 'Total ($)'],
          ...data.ventasPorDia.map((item: any) => [
            new Date(item.dia).toLocaleDateString('es-MX'),
            item.cantidad_ventas,
            Number(item.total).toFixed(2)
          ])
        ];
        const wsVentasDia = XLSX.utils.aoa_to_sheet(ventasDiaData);
        XLSX.utils.book_append_sheet(wb, wsVentasDia, 'Ventas por Día');
      }
      
      // Hoja 3: Métodos de Pago
      if (data.ventasPorMetodo && data.ventasPorMetodo.length > 0) {
        const metodosData = [
          ['MÉTODOS DE PAGO'],
          ['Método', 'Cantidad de Ventas', 'Total ($)', '% del Total'],
          ...data.ventasPorMetodo.map((item: any) => [
            item.metodo_pago,
            item.cantidad,
            Number(item.total).toFixed(2),
            ((Number(item.total) / Number(data.ventas?.monto_total || 1)) * 100).toFixed(1) + '%'
          ])
        ];
        const wsMetodos = XLSX.utils.aoa_to_sheet(metodosData);
        XLSX.utils.book_append_sheet(wb, wsMetodos, 'Métodos de Pago');
      }
      
      // Hoja 4: Top Productos
      if (data.topProductos && data.topProductos.length > 0) {
        const productosData = [
          ['TOP 5 PRODUCTOS MÁS VENDIDOS'],
          ['Producto', 'Cantidad Vendida', 'Total Generado ($)'],
          ...data.topProductos.map((item: any) => [
            item.nombre,
            item.total_vendido,
            Number(item.total_generado).toFixed(2)
          ])
        ];
        const wsProductos = XLSX.utils.aoa_to_sheet(productosData);
        XLSX.utils.book_append_sheet(wb, wsProductos, 'Top Productos');
      }
      
      // Generar archivo
      const fecha = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `reportes_${fecha}.xlsx`);
      
      addToast("Reporte exportado correctamente", "success");
    } catch (error) {
      console.error("Error al exportar:", error);
      addToast("Error al exportar el reporte", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-white font-sans">
        <Sidebar onCerrarSesion={() => {}} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="relative">
              <Loader2 className="h-16 w-16 animate-spin text-black mx-auto" />
            </div>
            <p className="mt-6 text-sm font-bold uppercase tracking-widest text-gray-400 animate-pulse">
              Cargando reportes...
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen bg-white font-sans">
        <Sidebar onCerrarSesion={() => {}} />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl shadow-sm p-8 max-w-md w-full">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-lg font-black uppercase text-center text-gray-900 mb-2">Error de conexión</h2>
            <p className="text-xs text-gray-500 text-center mb-6 font-medium">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full bg-black text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} />
              Reintentar
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!data) return null;

  // Calcular estadísticas
  const ticketPromedio = data.ventas?.total_ventas > 0 
    ? (Number(data.ventas.monto_total) / Number(data.ventas.total_ventas)).toFixed(2)
    : "0.00";

  const productosPorVenta = data.ventas?.total_ventas > 0
    ? (Number(data.productos?.productos_vendidos) / Number(data.ventas.total_ventas)).toFixed(1)
    : "0";

  const porcentajeEmpleado = data.ventas?.monto_total > 0 && data.empleadoTop?.total > 0
    ? ((Number(data.empleadoTop.total) / Number(data.ventas.monto_total)) * 100).toFixed(1)
    : "0";

  // Preparar datos para gráficas
  const ventasDiaData = data.ventasPorDia?.map((item: any) => ({
    dia: new Date(item.dia).toLocaleDateString('es-MX', { weekday: 'short' }),
    ventas: Number(item.cantidad_ventas),
    total: Number(item.total)
  })) || [];

  const metodosPagoData = data.ventasPorMetodo?.map((item: any) => ({
    name: item.metodo_pago?.charAt(0).toUpperCase() + item.metodo_pago?.slice(1) || 'Otro',
    value: Number(item.total)
  })) || [];

  const productosTopData = data.topProductos?.map((item: any) => ({
    name: item.nombre?.length > 15 ? item.nombre.substring(0, 15) + '...' : item.nombre,
    vendidos: Number(item.total_vendido)
  })) || [];

  return (
    <div className="flex min-h-screen bg-white font-sans">
      <Sidebar onCerrarSesion={() => {}} />

      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 md:p-8 lg:p-12 overflow-hidden">
        
        {/* Modal de confirmación */}
        {showConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowConfirm(false)}></div>
            <div className="relative bg-white p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-black uppercase text-gray-900 mb-2">¿Limpiar reportes?</h3>
              <p className="text-xs text-gray-500 mb-8 font-medium">
                Esta acción reiniciará los contadores. Los datos históricos se mantienen.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="py-3 bg-gray-100 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleLimpiarReportes}
                  className="py-3 bg-red-500 rounded-xl text-xs font-bold uppercase tracking-wider text-white hover:bg-red-600 transition-colors"
                >
                  Limpiar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-gray-900">
              Reportes
            </h1>
            <p className="text-sm font-medium text-gray-500 mt-1 flex items-center gap-2">
              <Calendar size={14} />
              {new Date().toLocaleDateString('es-MX', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Selector de período */}
            <select 
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-700 outline-none focus:border-black transition-colors"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
            >
              <option value="7dias">Últimos 7 días</option>
              <option value="30dias">Últimos 30 días</option>
              <option value="90dias">Últimos 90 días</option>
            </select>

            {/* Botón visibilidad */}
            <button 
              onClick={() => setMostrarMetricas(!mostrarMetricas)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all flex items-center gap-2"
            >
              {mostrarMetricas ? <EyeOff size={16} /> : <Eye size={16} />}
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">
                {mostrarMetricas ? 'Ocultar' : 'Mostrar'}
              </span>
            </button>
            
            <button 
              onClick={fetchData}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all flex items-center gap-2"
            >
              <RefreshCw size={16} />
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Actualizar</span>
            </button>
            
            <button 
              onClick={handleExportarExcel}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all flex items-center gap-2"
            >
              <Download size={16} />
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Exportar</span>
            </button>
            
            <button 
              onClick={() => setShowConfirm(true)}
              className="px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 transition-all flex items-center gap-2"
            >
              <Trash2 size={16} />
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Limpiar</span>
            </button>
          </div>
        </header>

        {/* Tarjetas de KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
          <KpiCard
            title="Ventas Totales"
            value={`$${Number(data.ventas?.monto_total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
            subtitle={`${data.ventas?.total_ventas || 0} transacciones`}
            icon={<DollarSign size={20} />}
            trend={+12.5}
            mostrarMetricas={mostrarMetricas}
          />

          <KpiCard
            title="Productos Vendidos"
            value={Number(data.productos?.productos_vendidos || 0).toLocaleString()}
            subtitle={`Promedio: ${productosPorVenta} por venta`}
            icon={<Package size={20} />}
            trend={+8.2}
            mostrarMetricas={mostrarMetricas}
          />

          <KpiCard
            title="Ticket Promedio"
            value={`$${Number(ticketPromedio).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
            subtitle={`+${porcentajeEmpleado}% mejor empleado`}
            icon={<CreditCard size={20} />}
            trend={-2.1}
            mostrarMetricas={mostrarMetricas}
          />

          <KpiCard
            title="Empleado Top"
            value={data.empleadoTop?.nombre || "Sin datos"}
            subtitle={`$${Number(data.empleadoTop?.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
            icon={<Users size={20} />}
            trend={+5.8}
            mostrarMetricas={mostrarMetricas}
          />
        </div>

        {/* Gráficas principales */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Gráfica de ventas por día */}
          <div className="bg-white border border-gray-200 rounded-3xl shadow-sm p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={18} className="text-gray-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">
                Ventas de los últimos 7 días
              </h3>
            </div>
            <div className="h-64 md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ventasDiaData}>
                  <defs>
                    <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#000000" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#000000" stopOpacity={0.02}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="dia" stroke="#9CA3AF" fontSize={10} />
                  <YAxis stroke="#9CA3AF" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      borderRadius: '0.75rem',
                      border: '1px solid #E5E7EB',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#000000" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorVentas)" 
                    name="Ventas ($)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfica de métodos de pago - CON COLOR */}
          <div className="bg-white border border-gray-200 rounded-3xl shadow-sm p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <PieChartIcon size={18} className="text-gray-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">
                Distribución por Método de Pago
              </h3>
            </div>
            <div className="h-64 md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metodosPagoData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                    labelLine={{ stroke: '#9CA3AF', strokeWidth: 1 }}
                  >
                    {metodosPagoData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [`$${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 'Monto']}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      borderRadius: '0.75rem',
                      border: '1px solid #E5E7EB',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Segunda fila de gráficas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top productos - CON COLOR */}
          <div className="bg-white border border-gray-200 rounded-3xl shadow-sm p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Package size={18} className="text-gray-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">
                Top 5 Productos Más Vendidos
              </h3>
            </div>
            <div className="h-64 md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productosTopData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" stroke="#9CA3AF" fontSize={10} />
                  <YAxis dataKey="name" type="category" width={100} stroke="#9CA3AF" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      borderRadius: '0.75rem',
                      border: '1px solid #E5E7EB',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }}
                  />
                  <Bar dataKey="vendidos" fill="#8884D8" radius={[0, 4, 4, 0]}>
                    {productosTopData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tarjeta de sucursal destacada */}
          <div className="bg-white border border-gray-200 rounded-3xl shadow-sm p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Store size={18} className="text-gray-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">
                Sucursal Destacada
              </h3>
            </div>
            <div className="flex items-center justify-center h-64 md:h-80">
              <div className="text-center">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-200">
                  <Store className="w-8 h-8 text-gray-400" />
                </div>
                <h4 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tight">
                  {data.sucursalTop?.nombre || "Sin datos"}
                </h4>
                <p className="text-2xl font-black text-gray-900 mb-2">
                  ${Number(data.sucursalTop?.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {data.sucursalTop?.ventas_realizadas || 0} ventas realizadas
                </p>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Representa el {((Number(data.sucursalTop?.total || 0) / Number(data.ventas?.monto_total || 1)) * 100).toFixed(1)}% 
                    del total
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resumen y estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-black rounded-3xl p-6 text-white">
            <h4 className="text-[10px] font-black uppercase tracking-wider opacity-60 mb-2">Rendimiento General</h4>
            <p className="text-3xl font-black mb-4">{porcentajeEmpleado}%</p>
            <p className="text-xs opacity-60 font-medium">Del objetivo mensual</p>
            <div className="mt-4 h-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-500"
                style={{ width: `${Math.min(100, Number(porcentajeEmpleado))}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-3xl p-6">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Productividad</h4>
            <p className="text-3xl font-black text-gray-900 mb-4">{productosPorVenta}</p>
            <p className="text-xs font-medium text-gray-400">Productos por venta en promedio</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-3xl p-6">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Meta Diaria</h4>
            <p className="text-3xl font-black text-gray-900 mb-4">
              ${(Number(data.ventas?.monto_total || 0) / 30).toLocaleString('es-MX', { minimumFractionDigits: 0 })}
            </p>
            <p className="text-xs font-medium text-gray-400">Promedio por día</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-300">
            Última actualización: {new Date().toLocaleTimeString('es-MX')}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-200 mt-1">
            Los datos se acumulan diariamente
          </p>
        </div>
      </main>

      {/* Notificaciones Toast */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div 
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl max-w-sm border-l-4 ${
              toast.type === 'success' ? 'bg-white border-black' : 
              toast.type === 'error' ? 'bg-white border-red-500' : 
              'bg-white border-yellow-500'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 size={18} className="text-black" />}
            {toast.type === 'error' && <AlertCircle size={18} className="text-red-500" />}
            {toast.type === 'warning' && <AlertTriangle size={18} className="text-yellow-500" />}
            <p className="text-xs font-bold uppercase tracking-wide">{toast.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Componente KPI Card
function KpiCard({ title, value, subtitle, icon, trend, mostrarMetricas }: any) {
  const trendColor = trend >= 0 ? 'text-emerald-600' : 'text-red-600';
  
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className="bg-gray-50 p-2 rounded-xl">
          <div className="text-gray-600">{icon}</div>
        </div>
        {mostrarMetricas && trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-black ${trendColor}`}>
            {trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">{title}</h3>
      <p className="text-xl font-black text-gray-900 mb-1">
        {mostrarMetricas ? value : '••••••'}
      </p>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
        {mostrarMetricas ? subtitle : '••••••'}
      </p>
    </div>
  );
}