"use client";

import Sidebar from "@/app/components/Sidebar";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, ShoppingCart } from "lucide-react";

/* =======================
   TIPOS
======================= */
interface Producto {
  id: string;
  nombre: string;
  sku: string;
  precio: number;
  stock: number;
}

interface ItemCarrito extends Producto {
  cantidad: number;
}

/* =======================
   COMPONENTE
======================= */
export default function VentasPage() {
  const { data: session } = useSession();

  const [sucursalNombre, setSucursalNombre] = useState("");
  const [inventarioGlobal, setInventarioGlobal] = useState<Producto[]>([]);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [busqueda, setBusqueda] = useState("");

  const [metodoPago, setMetodoPago] = useState<
    "Efectivo" | "Tarjeta" | "Transferencia"
  >("Efectivo");

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ventaExitosa, setVentaExitosa] = useState(false);

  /* =======================
     SUCURSAL
  ======================= */
  useEffect(() => {
    if (!session?.user) return;

    const user = session.user as any;
    const guardada = localStorage.getItem("sucursalActiva");

    const sucursalFinal =
      user?.role === "admin" && guardada
        ? guardada
        : user?.sucursal || "Sucursal Principal";

    setSucursalNombre(sucursalFinal);
  }, [session]);

  /* =======================
     INVENTARIO
  ======================= */
  const cargarProductos = useCallback(async () => {
    if (!sucursalNombre) return;

    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/inventario?sucursal=${encodeURIComponent(sucursalNombre)}`,
        { credentials: "include" }
      );

      if (!res.ok) throw new Error("Error al cargar inventario");

      const data = await res.json();
      setInventarioGlobal(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("❌ Inventario:", err);
    } finally {
      setIsLoading(false);
    }
  }, [sucursalNombre]);

  useEffect(() => {
    cargarProductos();
  }, [cargarProductos]);

  /* =======================
     CARRITO
  ======================= */
  const agregarAlCarrito = (p: Producto) => {
    setCarrito((prev) => {
      const existe = prev.find((i) => i.id === p.id);
      const cantidadActual = existe ? existe.cantidad : 0;

      if (cantidadActual + 1 > p.stock) {
        alert(`Stock insuficiente. Solo quedan ${p.stock}`);
        return prev;
      }

      return existe
        ? prev.map((i) =>
            i.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i
          )
        : [...prev, { ...p, cantidad: 1 }];
    });

    setBusqueda("");
  };

  /* =======================
     COBRAR
  ======================= */
  const handleCobrar = async () => {
    if (carrito.length === 0 || isProcessing) return;

    setIsProcessing(true);

    try {
      const res = await fetch("/api/ventas", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productos: carrito.map((p) => ({
            id: p.id,
            cantidad: p.cantidad,
          })),
          metodo_pago: metodoPago,
          sucursal_id: sucursalNombre,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error || "Error al procesar venta");
      }

      await res.json();

      setVentaExitosa(true);
      setCarrito([]);
      await cargarProductos();

      setTimeout(() => setVentaExitosa(false), 2000);
    } catch (err: any) {
      alert("❌ " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  /* =======================
     DERIVADOS
  ======================= */
  const productosVisibles = useMemo(() => {
    const term = busqueda.toLowerCase().trim();
    return inventarioGlobal.filter(
      (p) =>
        p.nombre.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term)
    );
  }, [busqueda, inventarioGlobal]);

  const totalVenta = carrito.reduce(
    (acc, i) => acc + i.precio * i.cantidad,
    0
  );

  const formatMoney = (n: number) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(n);

  /* =======================
     UI
  ======================= */
  return (
    <div className="flex h-screen bg-[#F3F4F6] overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col lg:flex-row">
        {/* IZQUIERDA */}
        <div className="flex-1 p-6 flex flex-col gap-6 overflow-hidden">
          <header className="flex justify-between items-end border-b pb-2">
            <div>
              <h2 className="text-xs font-bold text-slate-500">
                Punto de Venta
              </h2>
              <h1 className="text-2xl font-black">
                {sucursalNombre || "Cargando..."}
              </h1>
            </div>

            <button onClick={cargarProductos}>
              <RefreshCw
                size={18}
                className={isLoading ? "animate-spin" : ""}
              />
            </button>
          </header>

          <input
            className="border rounded-xl px-4 py-3"
            placeholder="Buscar por nombre o SKU..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto">
            {productosVisibles.map((p) => (
              <button
                key={p.id}
                disabled={p.stock <= 0}
                onClick={() => agregarAlCarrito(p)}
                className="bg-white p-4 rounded-xl border text-left disabled:opacity-50"
              >
                <p className="text-xs font-bold">{p.sku}</p>
                <p className="font-black">{p.nombre}</p>
                <p className="text-xs">Stock: {p.stock}</p>
                <p className="font-bold">{formatMoney(p.precio)}</p>
              </button>
            ))}
          </div>
        </div>

        {/* DERECHA */}
        <div className="w-full lg:w-[400px] bg-white border-l flex flex-col">
          <div className="p-6 border-b font-black flex gap-2 items-center">
            <ShoppingCart /> Detalle de Venta
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {carrito.map((item) => (
              <div key={item.id} className="border p-3 rounded-xl">
                <p className="font-bold">{item.nombre}</p>
                <p>{formatMoney(item.precio * item.cantidad)}</p>
              </div>
            ))}
          </div>

          <div className="p-6 border-t">
            <div className="flex justify-between mb-4">
              <span>Total</span>
              <span className="text-2xl font-black">
                {formatMoney(totalVenta)}
              </span>
            </div>

            <button
              onClick={handleCobrar}
              disabled={isProcessing}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-black disabled:opacity-50"
            >
              {isProcessing ? "Procesando..." : "Finalizar Venta"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
