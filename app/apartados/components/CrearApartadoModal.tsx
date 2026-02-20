"use client";

import { useEffect, useState } from "react";

interface Producto {
  id: number;
  nombre: string;
  precio: number;
  stock: number;
}

interface ProductoSeleccionado {
  id: number;
  nombre: string;
  precio: number;
  cantidad: number;
  stockDisponible: number;
}

interface Sucursal {
  id: number;
  nombre: string;
}

interface CrearApartadoModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CrearApartadoModal({ onClose, onSuccess }: CrearApartadoModalProps) {
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalId, setSucursalId] = useState<number>(1);
  const [cliente, setCliente] = useState("");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [productosSeleccionados, setProductosSeleccionados] = useState<ProductoSeleccionado[]>([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState<string>("");
  const [cantidad, setCantidad] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSucursales();
  }, []);

  useEffect(() => {
    if (sucursalId) {
      fetchProductos();
    }
  }, [sucursalId]);

  async function fetchSucursales() {
    try {
      const res = await fetch("/api/sucursales");
      const data = await res.json();
      setSucursales(data);
    } catch (error) {
      console.error("Error al cargar sucursales:", error);
    }
  }

  async function fetchProductos() {
    try {
      const res = await fetch(`/api/productos-por-sucursal?sucursalId=${sucursalId}`);
      const data = await res.json();
      setProductos(data);
    } catch (error) {
      console.error("Error al cargar productos:", error);
    }
  }

  function agregarProducto() {
    if (!productoSeleccionado) {
      setError("Selecciona un producto");
      return;
    }

    const producto = productos.find(p => p.id === Number(productoSeleccionado));
    if (!producto) return;

    if (cantidad > producto.stock) {
      setError(`Stock disponible: ${producto.stock}`);
      return;
    }

    const existente = productosSeleccionados.findIndex(p => p.id === producto.id);
    
    if (existente !== -1) {
      const nuevaCantidad = productosSeleccionados[existente].cantidad + cantidad;
      if (nuevaCantidad > producto.stock) {
        setError(`Stock disponible: ${producto.stock}`);
        return;
      }
      
      const nuevos = [...productosSeleccionados];
      nuevos[existente].cantidad = nuevaCantidad;
      setProductosSeleccionados(nuevos);
    } else {
      setProductosSeleccionados([
        ...productosSeleccionados,
        {
          id: producto.id,
          nombre: producto.nombre,
          precio: producto.precio,
          cantidad: cantidad,
          stockDisponible: producto.stock
        }
      ]);
    }

    setProductoSeleccionado("");
    setCantidad(1);
    setError("");
  }

  function eliminarProducto(id: number) {
    setProductosSeleccionados(productosSeleccionados.filter(p => p.id !== id));
  }

  function actualizarCantidad(id: number, nuevaCantidad: number) {
    const producto = productosSeleccionados.find(p => p.id === id);
    const productoOriginal = productos.find(p => p.id === id);
    
    if (!producto || !productoOriginal) return;
    
    if (nuevaCantidad > productoOriginal.stock) {
      setError(`Stock disponible: ${productoOriginal.stock}`);
      return;
    }
    
    if (nuevaCantidad < 1) return;
    
    const nuevos = productosSeleccionados.map(p => 
      p.id === id ? { ...p, cantidad: nuevaCantidad } : p
    );
    setProductosSeleccionados(nuevos);
    setError("");
  }

  async function crearApartado() {
    if (!cliente.trim()) {
      setError("El nombre del cliente es requerido");
      return;
    }

    if (productosSeleccionados.length === 0) {
      setError("Agrega al menos un producto");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/apartados", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cliente,
          sucursal_id: sucursalId,
          productos: productosSeleccionados.map(p => ({
            id: p.id,
            cantidad: p.cantidad,
            nombre: p.nombre
          }))
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al crear apartado");
      }

      onSuccess();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  const total = productosSeleccionados.reduce((sum, p) => sum + (p.precio * p.cantidad), 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Nuevo Apartado</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* Selección de Sucursal */}
          <div className="mb-6">
            <label className="block font-semibold mb-2">Sucursal</label>
            <select
              value={sucursalId}
              onChange={(e) => setSucursalId(Number(e.target.value))}
              className="w-full border rounded p-2"
              disabled={productosSeleccionados.length > 0}
            >
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Datos del Cliente */}
          <div className="mb-6">
            <label className="block font-semibold mb-2">Cliente</label>
            <input
              type="text"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nombre del cliente"
              className="w-full border rounded p-2"
            />
          </div>

          {/* Agregar Productos */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Agregar Productos</h3>
            <div className="flex gap-2">
              <select
                value={productoSeleccionado}
                onChange={(e) => setProductoSeleccionado(e.target.value)}
                className="flex-1 border rounded p-2"
              >
                <option value="">Seleccionar producto</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} - ${p.precio} (Stock: {p.stock})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value))}
                className="w-24 border rounded p-2"
              />
              <button
                onClick={agregarProducto}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Agregar
              </button>
            </div>
          </div>

          {/* Tabla de Productos Seleccionados */}
          {productosSeleccionados.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Productos Apartados</h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-left">Producto</th>
                    <th className="border p-2 text-left">Precio</th>
                    <th className="border p-2 text-left">Cantidad</th>
                    <th className="border p-2 text-left">Subtotal</th>
                    <th className="border p-2 text-left">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {productosSeleccionados.map((p) => (
                    <tr key={p.id}>
                      <td className="border p-2">{p.nombre}</td>
                      <td className="border p-2">${p.precio}</td>
                      <td className="border p-2">
                        <input
                          type="number"
                          min="1"
                          max={p.stockDisponible}
                          value={p.cantidad}
                          onChange={(e) => actualizarCantidad(p.id, Number(e.target.value))}
                          className="w-20 border rounded p-1"
                        />
                      </td>
                      <td className="border p-2">${p.precio * p.cantidad}</td>
                      <td className="border p-2">
                        <button
                          onClick={() => eliminarProducto(p.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-bold">
                    <td colSpan={3} className="border p-2 text-right">
                      Total:
                    </td>
                    <td className="border p-2">${total}</td>
                    <td className="border p-2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Botones de Acción */}
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              onClick={crearApartado}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {loading ? "Creando..." : "Crear Apartado"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}