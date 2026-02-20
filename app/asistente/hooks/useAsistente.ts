"use client";

import { useState, useCallback, useEffect } from "react";

interface Mensaje {
  tipo: "usuario" | "sistema";
  mensaje: string;
  fecha?: string;
  productos?: any[]; // 👈 Agregamos esto para que TS lo reconozca
}

export interface Producto {
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

interface ApiResponse {
  success: boolean;
  respuesta?: string;
  fecha?: string;
  productos?: Producto[];
  error?: string;
}

export function useAsistente() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(false);

  /* =========================
     CARGAR DESDE LOCALSTORAGE
  ==========================*/
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mensajesGuardados = localStorage.getItem("asistente_mensajes");
    const productosGuardados = localStorage.getItem("asistente_productos");

    if (mensajesGuardados) {
      setMensajes(JSON.parse(mensajesGuardados));
    }

    if (productosGuardados) {
      setProductos(JSON.parse(productosGuardados));
    }
  }, []);

  /* =========================
     GUARDAR EN LOCALSTORAGE
  ==========================*/
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("asistente_mensajes", JSON.stringify(mensajes));
  }, [mensajes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("asistente_productos", JSON.stringify(productos));
  }, [productos]);

  const enviarMensaje = useCallback(async (texto: string) => {
    if (!texto.trim()) return;

    setLoading(true);

    // 🔴 Se mantienen productos solo de la búsqueda actual
    setProductos([]);

    


    const mensajeUsuario: Mensaje = {
      tipo: "usuario",
      mensaje: texto,
      fecha: new Date().toISOString(),
    };

    setMensajes((prev) => [...prev, mensajeUsuario]);

    try {
      const res = await fetch("/api/asistente", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mensaje: texto }),
      });

      const data: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error en la respuesta del servidor");
      }

      if (data.success) {
        const mensajeSistema: Mensaje = {
          tipo: "sistema",
          mensaje: data.respuesta || "Sin respuesta del asistente.",
          fecha: data.fecha || new Date().toISOString(),
          productos: data.productos || [], // 🔥 clave
        };

        setMensajes((prev) => [...prev, mensajeSistema]);

        // ✅ Reemplaza productos (sin acumulación ni duplicados)
        if (data.productos?.length) {
          setProductos(data.productos);
        }
      } else {
        throw new Error(data.error || "La operación no fue exitosa");
      }
    } catch (error: any) {
      const mensajeError: Mensaje = {
        tipo: "sistema",
        mensaje:
          error?.message || "Error de conexión. Por favor, intenta de nuevo.",
        fecha: new Date().toISOString(),
      };

      setMensajes((prev) => [...prev, mensajeError]);
    } finally {
      setLoading(false);
    }
  }, []);

  const reiniciar = useCallback(() => {
    setMensajes([]);
    setProductos([]);

    if (typeof window !== "undefined") {
      localStorage.removeItem("asistente_mensajes");
      localStorage.removeItem("asistente_productos");
    }
  }, []);

  return {
    mensajes,
    productos,
    enviarMensaje,
    loading,
    reiniciar,
    
  };
}
