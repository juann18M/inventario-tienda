"use client";

import { useState } from "react";

interface ApartadoCardProps {
  apartado: {
    id: number;
    cliente: string;
    total: number;
    fecha: string;
    productos: { nombre: string; cantidad: number }[];
    estado?: string;
    sucursal_nombre?: string;
  };
  onCancelar: () => void;
}

export default function ApartadoCard({ apartado, onCancelar }: ApartadoCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function cancelarApartado() {
    setLoading(true);
    try {
      const res = await fetch(`/api/apartados/${apartado.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setShowConfirm(false);
        onCancelar();
      } else {
        const data = await res.json();
        alert(data.error || "Error al cancelar el apartado");
      }
    } catch (error) {
      alert("Error al cancelar el apartado");
    } finally {
      setLoading(false);
    }
  }

  const isCancelado = apartado.estado === "cancelado";

  return (
    <div className={`border rounded-lg p-4 shadow hover:shadow-lg transition ${isCancelado ? 'bg-gray-50 opacity-75' : ''}`}>
      <h2 className="font-bold text-lg">Cliente: {apartado.cliente}</h2>
      <p className="text-sm text-gray-600">ID: {apartado.id}</p>
      <p className="text-sm text-gray-600">Sucursal: {apartado.sucursal_nombre || 'N/A'}</p>
      <p className="text-lg font-semibold text-green-700">Total: ${apartado.total}</p>
      <p className="text-sm text-gray-600">Fecha: {new Date(apartado.fecha).toLocaleDateString()}</p>
      
      {apartado.estado && (
        <p className={`mt-1 font-semibold ${isCancelado ? 'text-red-600' : 'text-green-600'}`}>
          Estado: {apartado.estado}
        </p>
      )}

      <p className="font-semibold mt-3 mb-1">Productos:</p>
      <ul className="list-disc list-inside text-sm">
        {apartado.productos.map((prod, index) => (
          <li key={index}>
            {prod.nombre} x {prod.cantidad}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex gap-2">
        {!isCancelado && (
          <>
            <button className="flex-1 bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 text-sm">
              Ver Detalle
            </button>
            <button 
              onClick={() => setShowConfirm(true)}
              className="flex-1 bg-red-500 text-white px-3 py-2 rounded hover:bg-red-600 text-sm"
            >
              Cancelar
            </button>
          </>
        )}
        {isCancelado && (
          <div className="w-full text-center py-2 text-gray-500 border rounded text-sm">
            Apartado Cancelado
          </div>
        )}
      </div>

      {/* Modal de confirmación para cancelar */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-sm">
            <h3 className="text-lg font-bold mb-4">Cancelar Apartado</h3>
            <p className="mb-6">
              ¿Estás seguro de cancelar este apartado? Se devolverá el stock a la sucursal.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 border rounded hover:bg-gray-100"
              >
                No
              </button>
              <button
                onClick={cancelarApartado}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
              >
                {loading ? "Cancelando..." : "Sí, Cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}