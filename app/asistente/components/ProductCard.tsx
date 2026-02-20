"use client";

import { Package, MapPin, ImageOff } from "lucide-react";
import { useState, useEffect } from "react";
import Image from "next/image";


interface Producto {
  id: number;
  nombre: string;
  sku: string;
  stock: number;
  precio: number;
  talla?: string;
  color?: string;
  imagen?: string;
  sucursal: string;
}

export default function ProductCard({ producto }: { producto: Producto }) {
  const [imagenError, setImagenError] = useState(false);
  const [imagenCargando, setImagenCargando] = useState(true);

  const imagenUrl = producto.imagen || null;

  useEffect(() => {
    setImagenError(false);
    setImagenCargando(true);
  }, [producto]);

  const handleImageError = () => {
    setImagenError(true);
    setImagenCargando(false);
  };

  const handleImageLoad = () => {
    setImagenCargando(false);
  };

  const getStockInfo = () => {
    if (producto.stock <= 0) {
      return { color: "bg-gray-100 text-gray-600", texto: "AGOTADO", icono: "❌" };
    }
    if (producto.stock <= 2) {
      return { color: "bg-red-100 text-red-700", texto: "¡URGENTE!", icono: "🔴" };
    }
    if (producto.stock <= 5) {
      return { color: "bg-yellow-100 text-yellow-700", texto: "Stock bajo", icono: "🟡" };
    }
    return { color: "bg-green-100 text-green-700", texto: "Disponible", icono: "🟢" };
  };

  const stockInfo = getStockInfo();

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 group">
      <div className="flex p-3 gap-3">

        {/* Imagen */}
        <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 shadow-sm">
          {imagenUrl && !imagenError ? (
            <div className="relative w-full h-full">
              {imagenCargando && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                </div>
              )}
              <Image
  src={imagenUrl}
  alt={producto.nombre}
  fill
  sizes="80px"
  className={`object-cover transition-opacity duration-300 ${
    imagenCargando ? "opacity-0" : "opacity-100"
  }`}
  onLoad={handleImageLoad}
  onError={handleImageError}
  loading="lazy"
/>

            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
              <ImageOff size={20} className="text-gray-400" />
              <span className="text-[8px] text-gray-400 mt-1">Sin imagen</span>
            </div>
          )}
        </div>

        {/* Información */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1 mb-1">
            <h4 className="font-bold text-sm text-gray-900 uppercase truncate flex-1">
              {producto.nombre}
            </h4>
            <span
              className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${stockInfo.color}`}
            >
              {stockInfo.icono} {stockInfo.texto}
            </span>
          </div>

          <p className="text-[9px] font-mono text-gray-500 mb-1.5">
            SKU: {producto.sku}
          </p>

          {(producto.talla || producto.color) && (
            <div className="flex flex-wrap gap-1 mb-2">
              {producto.talla && (
                <span className="text-[8px] bg-gray-100 px-1.5 py-0.5 rounded-full text-gray-700 border border-gray-200">
                  📏 Talla: {producto.talla}
                </span>
              )}
              {producto.color && (
                <span className="text-[8px] bg-gray-100 px-1.5 py-0.5 rounded-full text-gray-700 border border-gray-200">
                  🎨 Color: {producto.color}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-baseline gap-1">
              <span className="text-[9px] text-gray-500">$</span>
              <span className="text-base font-black text-gray-900">
                {producto.precio.toLocaleString("es-MX", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>

            <span
              className={`text-[9px] font-bold px-2 py-0.5 rounded ${stockInfo.color}`}
            >
              {producto.stock} {producto.stock === 1 ? "unidad" : "unidades"}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[9px] text-gray-500 bg-gray-50 p-1.5 rounded-lg">
            <MapPin size={10} className="text-gray-400" />
            <span className="truncate font-medium">
              {producto.sucursal}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
