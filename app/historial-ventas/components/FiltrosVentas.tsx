"use client";

import { Search, Calendar, User, Building, CreditCard, X, Filter, ChevronDown } from "lucide-react";
import { useState } from "react";

interface Filtros {
  fechaInicio: string;
  fechaFin: string;
  usuarioId: string;
  sucursalId: string;
  metodoPago: string;
  cliente: string;
}

interface Usuario {
  id: number;
  nombre: string;
  sucursal_nombre: string;
}

interface Sucursal {
  id: number;
  nombre: string;
}

interface Props {
  filtros: Filtros;
  onFiltroChange: (filtros: Partial<Filtros>) => void;
  usuarios: Usuario[];
  sucursales: Sucursal[];
  isAdmin: boolean;
}

const METODOS_PAGO = [
  { value: "", label: "Todos los métodos" },
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
];

export default function FiltrosVentas({
  filtros,
  onFiltroChange,
  usuarios,
  sucursales,
  isAdmin,
}: Props) {
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  // -------------------------
  // DEFAULT FECHAS (7 DÍAS)
  // -------------------------
  const hoy = new Date();
  const hace7Dias = new Date();
  hace7Dias.setDate(hoy.getDate() - 7);

  const formatDate = (date: Date) => date.toISOString().split("T")[0];

  // Contar filtros activos
  const filtrosActivos = Object.entries(filtros).filter(([key, value]) => {
    if (key === 'fechaInicio' && value === formatDate(hace7Dias)) return false;
    if (key === 'fechaFin' && value === formatDate(hoy)) return false;
    return value && value.trim() !== "";
  }).length;

  // -------------------------
  // HANDLERS
  // -------------------------
  const limpiarFiltros = () => {
    onFiltroChange({
      fechaInicio: formatDate(hace7Dias),
      fechaFin: formatDate(hoy),
      usuarioId: "",
      sucursalId: "",
      metodoPago: "",
      cliente: "",
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header - Siempre visible */}
      <div className="p-4 md:p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white rounded-lg border border-gray-200">
            <Filter size={16} className="text-gray-700" />
          </div>
          <div>
            <h3 className="text-sm md:text-base font-bold text-gray-900 uppercase tracking-tight">
              Filtros de Búsqueda
            </h3>
            <p className="text-[10px] text-gray-500 mt-0.5 hidden sm:block">
              {filtrosActivos > 0 
                ? `${filtrosActivos} filtro${filtrosActivos !== 1 ? 's' : ''} activo${filtrosActivos !== 1 ? 's' : ''}`
                : 'Sin filtros aplicados'
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {filtrosActivos > 0 && (
            <button
              onClick={limpiarFiltros}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={14} />
              Limpiar todo
            </button>
          )}
          
          {/* Botón toggle para móvil */}
          <button
            onClick={() => setIsMobileExpanded(!isMobileExpanded)}
            className="md:hidden p-2 bg-white border border-gray-200 rounded-lg flex items-center justify-center"
          >
            <ChevronDown 
              size={18} 
              className={`text-gray-600 transition-transform duration-300 ${isMobileExpanded ? 'rotate-180' : ''}`} 
            />
          </button>
        </div>
      </div>

      {/* Contenido filtros - Expandible en móvil */}
      <div className={`
        transition-all duration-300 ease-in-out
        ${isMobileExpanded ? 'block' : 'hidden md:block'}
      `}>
        <div className="p-4 md:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
            {/* Fecha inicio */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold uppercase tracking-wider text-gray-500">
                <Calendar size={12} className="md:w-3.5 md:h-3.5" />
                Fecha Inicio
              </label>
              <input
                type="date"
                value={filtros.fechaInicio || formatDate(hace7Dias)}
                onChange={(e) => onFiltroChange({ fechaInicio: e.target.value })}
                className="w-full px-3 py-2 md:py-2.5 bg-white border border-gray-300 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition-all"
              />
            </div>

            {/* Fecha fin */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold uppercase tracking-wider text-gray-500">
                <Calendar size={12} className="md:w-3.5 md:h-3.5" />
                Fecha Fin
              </label>
              <input
                type="date"
                value={filtros.fechaFin || formatDate(hoy)}
                onChange={(e) => onFiltroChange({ fechaFin: e.target.value })}
                className="w-full px-3 py-2 md:py-2.5 bg-white border border-gray-300 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition-all"
              />
            </div>

            {/* Método pago */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold uppercase tracking-wider text-gray-500">
                <CreditCard size={12} className="md:w-3.5 md:h-3.5" />
                Método de Pago
              </label>
              <select
                value={filtros.metodoPago}
                onChange={(e) => onFiltroChange({ metodoPago: e.target.value })}
                className="w-full px-3 py-2 md:py-2.5 bg-white border border-gray-300 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition-all appearance-none"
              >
                {METODOS_PAGO.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Cliente */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold uppercase tracking-wider text-gray-500">
                <User size={12} className="md:w-3.5 md:h-3.5" />
                Cliente
              </label>
              <input
                type="text"
                value={filtros.cliente}
                onChange={(e) => onFiltroChange({ cliente: e.target.value })}
                className="w-full px-3 py-2 md:py-2.5 bg-white border border-gray-300 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition-all placeholder:text-gray-400"
                placeholder="Buscar cliente..."
              />
            </div>

            {isAdmin && (
              <>
                {/* Usuario */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold uppercase tracking-wider text-gray-500">
                    <User size={12} className="md:w-3.5 md:h-3.5" />
                    Vendedor
                  </label>
                  <select
                    value={filtros.usuarioId}
                    onChange={(e) => onFiltroChange({ usuarioId: e.target.value })}
                    className="w-full px-3 py-2 md:py-2.5 bg-white border border-gray-300 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition-all appearance-none"
                  >
                    <option value="">Todos los vendedores</option>
                    {usuarios.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre} - {u.sucursal_nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sucursal */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold uppercase tracking-wider text-gray-500">
                    <Building size={12} className="md:w-3.5 md:h-3.5" />
                    Sucursal
                  </label>
                  <select
                    value={filtros.sucursalId}
                    onChange={(e) => onFiltroChange({ sucursalId: e.target.value })}
                    className="w-full px-3 py-2 md:py-2.5 bg-white border border-gray-300 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition-all appearance-none"
                  >
                    <option value="">Todas las sucursales</option>
                    {sucursales.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Footer con acciones */}
          <div className="mt-5 md:mt-6 pt-4 md:pt-5 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3">
            {/* Contador de filtros activos - visible en móvil */}
            <div className="sm:hidden text-[10px] text-gray-500">
              {filtrosActivos > 0 
                ? `${filtrosActivos} filtro${filtrosActivos !== 1 ? 's' : ''} activo${filtrosActivos !== 1 ? 's' : ''}`
                : 'Sin filtros aplicados'
              }
            </div>

            <div className="flex w-full sm:w-auto gap-2">
              {/* Botón limpiar - visible en móvil */}
              {filtrosActivos > 0 && (
                <button
                  onClick={limpiarFiltros}
                  className="flex-1 sm:flex-none px-4 py-2.5 md:px-5 md:py-2.5 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <X size={14} />
                  <span className="sm:hidden">Limpiar</span>
                  <span className="hidden sm:inline">Limpiar filtros</span>
                </button>
              )}

              {/* Botón aplicar */}
              <button
                onClick={() => onFiltroChange({})}
                className="flex-1 sm:flex-none px-4 py-2.5 md:px-6 md:py-2.5 bg-gray-900 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <Search size={14} />
                Aplicar Filtros
              </button>
            </div>

            {/* Hint de teclado - solo desktop */}
            <div className="hidden xl:block text-[10px] text-gray-400">
              <span className="border border-gray-200 rounded px-1.5 py-0.5">↵</span> Enter para aplicar
            </div>
          </div>
        </div>
      </div>

      {/* Badge de filtros activos para móvil (cuando está colapsado) */}
      {!isMobileExpanded && filtrosActivos > 0 && (
        <div className="md:hidden px-4 pb-4 -mt-2">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-600 bg-gray-100 px-2.5 py-1.5 rounded-full w-fit">
            <Filter size={12} />
            <span>{filtrosActivos} filtro{filtrosActivos !== 1 ? 's' : ''} activo{filtrosActivos !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}
    </div>
  );
}