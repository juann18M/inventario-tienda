"use client";

import Sidebar from "./components/Sidebar";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export default function Home() {
  const { data: session, status } = useSession();

  const [loading, setLoading] = useState(true);
  const [caja, setCaja] = useState<any>(null);
  const [montoInicial, setMontoInicial] = useState("");

  /* ===============================
     VERIFICAR CAJA AL INICIAR
  =============================== */
  useEffect(() => {
    if (!session) return;

    const cargarCaja = async () => {
      const res = await fetch("/api/caja");
      const data = await res.json();

      setCaja(data.data);
      setLoading(false);
    };

    cargarCaja();
  }, [session]);

  /* ===============================
     ABRIR CAJA
  =============================== */
  const abrirCaja = async () => {
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

    if (data.success) {
      setCaja({
        monto_inicial: data.monto_inicial,
      });
    } else {
      alert(data.error);
    }
  };

  if (status === "loading" || loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="flex">
      <Sidebar />

      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-6">
          Bienvenido {session?.user?.name}
        </h1>

        {/* CONTENEDOR CAJA */}
        {caja && (
          <div className="bg-white shadow rounded-xl p-6 w-80">
            <h2 className="font-bold text-lg">Caja abierta</h2>
            <p className="mt-2">
              Monto inicial: ${caja.monto_inicial}
            </p>
          </div>
        )}
      </main>

      {/* MODAL APERTURA */}
      {!caja && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl w-80">
            <h2 className="text-xl font-bold mb-4">
              Apertura de caja
            </h2>

            <input
              type="number"
              placeholder="Monto inicial"
              value={montoInicial}
              onChange={(e) => setMontoInicial(e.target.value)}
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
    </div>
  );
}