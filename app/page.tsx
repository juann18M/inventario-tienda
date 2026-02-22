"use client";

import Sidebar from "./components/Sidebar";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";

interface Caja {
  monto_inicial: number;
}

export default function Home() {
  const { data: session, status } = useSession();

  const [loading, setLoading] = useState(true);
  const [caja, setCaja] = useState<Caja | null>(null);

  const [montoInicial, setMontoInicial] = useState("");
  const [montoFinal, setMontoFinal] = useState("");

  const [mostrarCerrarCaja, setMostrarCerrarCaja] = useState(false);

  /* ===============================
     VERIFICAR CAJA AL ENTRAR
  =============================== */
  useEffect(() => {
    if (status !== "authenticated") return;

    const cargarCaja = async () => {
      try {
        const res = await fetch("/api/caja");
        const data = await res.json();

        setCaja(data.data ?? null);
      } catch (error) {
        console.error("Error cargando caja:", error);
      } finally {
        setLoading(false);
      }
    };

    cargarCaja();
  }, [status]);

  /* ===============================
     ABRIR CAJA
  =============================== */
  const abrirCaja = async () => {
    if (!montoInicial || Number(montoInicial) <= 0) {
      alert("Ingresa un monto inicial válido");
      return;
    }

    try {
      const res = await fetch("/api/caja", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          monto_inicial: Number(montoInicial),
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setCaja({
        monto_inicial: data.monto_inicial,
      });

      setMontoInicial("");
    } catch (err: any) {
      alert(err.message);
    }
  };

  /* ===============================
     CLICK EN FINALIZAR (SIDEBAR)
  =============================== */
  const intentarCerrarSesion = () => {
    if (!caja) {
      signOut(); // si no hay caja abierta, salir normal
      return;
    }

    setMostrarCerrarCaja(true);
  };

  /* ===============================
     CERRAR CAJA + LOGOUT
  =============================== */
  const cerrarCajaYSalir = async () => {
    if (!montoFinal || Number(montoFinal) <= 0) {
      alert("Debes ingresar el monto final");
      return;
    }

    try {
      const res = await fetch("/api/caja/cerrar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          monto_final: Number(montoFinal),
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      // ✅ cerrar sesión SOLO si guardó correctamente
      await signOut();
    } catch (err: any) {
      alert(err.message);
    }
  };

  /* ===============================
     LOADING
  =============================== */
  if (status === "loading" || loading) {
    return <div className="p-6">Cargando...</div>;
  }

  return (
    <div className="flex">
      {/* 👇 IMPORTANTE: nombre correcto de prop */}
      <Sidebar onCerrarSesion={intentarCerrarSesion} />

      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-6">
          Bienvenido {session?.user?.name}
        </h1>

        {/* CAJA ABIERTA */}
        {caja && (
          <div className="bg-white shadow rounded-xl p-6 w-80">
            <h2 className="font-bold text-lg">Caja abierta</h2>

            <p className="mt-2">
              💰 Monto inicial: ${caja.monto_inicial}
            </p>
          </div>
        )}
      </main>

      {/* ================= MODAL APERTURA ================= */}
      {!caja && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-80">
            <h2 className="text-xl font-bold mb-4">
              Apertura de caja
            </h2>

            <input
              type="number"
              min="0"
              value={montoInicial}
              onChange={(e) => setMontoInicial(e.target.value)}
              placeholder="Monto inicial"
              className="border w-full p-2 rounded mb-4"
            />

            <button
              onClick={abrirCaja}
              className="bg-blue-600 text-white w-full p-2 rounded"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL CIERRE ================= */}
      {mostrarCerrarCaja && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-80">
            <h2 className="text-xl font-bold mb-4">
              Cierre de caja
            </h2>

            <input
              type="number"
              min="0"
              value={montoFinal}
              onChange={(e) => setMontoFinal(e.target.value)}
              placeholder="Monto final en caja"
              className="border w-full p-2 rounded mb-4"
            />

            <button
              onClick={cerrarCajaYSalir}
              className="bg-red-600 text-white w-full p-2 rounded"
            >
              Guardar y cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}