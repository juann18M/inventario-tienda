"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, Bot, Sparkles, MessageSquare, AlertCircle } from "lucide-react";
import ChatInput from "./ChatInput";
import MessageBubble from "./MessageBubble";
import ProductCard from "./ProductCard";

// Interfaces
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

interface Mensaje {
  tipo: "usuario" | "sistema";
  mensaje: string;
  fecha?: string;
  productos?: Producto[];
}

interface Props {
  mensajes: Mensaje[];
  onSend: (texto: string) => Promise<void>;
  onReset: () => void;
  loading: boolean;
}

// Indicador de "Escribiendo..."
const TypingIndicator = () => (
  <div className="flex items-center gap-2 p-4 bg-gray-100 rounded-2xl rounded-tl-none w-fit animate-in fade-in slide-in-from-bottom-2 duration-300">
    <div className="flex gap-1">
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
    </div>
    <span className="text-xs text-gray-400 font-medium">Procesando...</span>
  </div>
);

export default function ChatContainer({
  mensajes,
  onSend,
  onReset,
  loading,
}: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [mensajes, loading]);

  // --- CORRECCIÓN AQUÍ ---
  // Mapeamos lo que ve el usuario (label) con lo que tu backend entiende (command)
  const quickQuestions = [
    { 
      emoji: "👟", 
      label: "Stock marca Nike", 
      command: "stock marca nike" // Coincide con case "stock_marca"
    },
    { 
      emoji: "🔻", 
      label: "Alertas Stock Bajo", 
      command: "stock bajo" // Coincide con case "stock_bajo"
    },
    { 
      emoji: "📊", 
      label: "Resumen General", 
      command: "resumen" // Coincide con case "resumen"
    },
    { 
      emoji: "📍", 
      label: "Sucursal Centro", 
      command: "productos en centro" // Coincide con case "productos_sucursal"
    }
  ];

  return (
    <div className="relative flex flex-col h-[70vh] md:h-[75vh] bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden font-sans">
      
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300">
                <Bot className="text-white w-6 h-6" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 leading-tight">
                Asistente de Inventario
              </h3>
              <p className="text-xs text-blue-600 font-medium flex items-center gap-1">
                <Sparkles size={10} /> IA Conectada
              </p>
            </div>
          </div>

          {mensajes.length > 0 && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={loading}
              className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors border border-transparent hover:border-red-100 group"
              title="Limpiar conversación"
            >
              <Trash2 size={18} className="group-hover:scale-110 transition-transform" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar bg-slate-50/30"
      >
        {mensajes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm rotate-3 transform transition-transform hover:rotate-6">
              <MessageSquare className="w-10 h-10 text-blue-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">¡Hola! ¿En qué te ayudo hoy?</h3>
            <p className="text-sm text-gray-500 max-w-xs mb-8">
              Puedo buscar productos, verificar stock entre sucursales o analizar precios.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => onSend(q.command)} // Enviamos el comando limpio
                  disabled={loading}
                  className="text-xs text-left px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-md hover:text-blue-600 transition-all duration-200 disabled:opacity-50 flex items-center gap-2"
                >
                  <span className="text-base">{q.emoji}</span>
                  <span className="font-medium">{q.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {mensajes.map((msg, index) => (
              <div key={`${msg.fecha}-${index}`} className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300 fill-mode-backwards">
                <MessageBubble
                  tipo={msg.tipo}
                  mensaje={msg.mensaje}
                  fecha={msg.fecha}
                />

                {msg.productos && msg.productos.length > 0 && (
                  <div className="pl-0 md:pl-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {msg.productos.map((prod) => (
                      <ProductCard key={prod.id} producto={prod} />
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {loading && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                 <TypingIndicator />
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} className="h-px" />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-gray-100">
        <ChatInput onSend={onSend} loading={loading} />
      </div>

      {/* Modal Confirmación */}
      {showConfirm && (
        <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 w-80 shadow-2xl border border-gray-100 scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-500">
                <AlertCircle size={24} />
              </div>
              <h4 className="font-bold text-gray-900 text-lg mb-2">
                ¿Limpiar historial?
              </h4>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                Se borrarán todos los mensajes y productos visualizados.
              </p>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    onReset();
                    setShowConfirm(false);
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/30 transition-all transform hover:scale-[1.02]"
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}