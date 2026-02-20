"use client";

import { useState, useRef, useEffect, KeyboardEvent, FormEvent } from "react";
import { Send, Loader2, ImagePlus, X } from "lucide-react";

interface Props {
  onSend: (texto: string) => Promise<void>;
  loading: boolean;
}

export default function ChatInput({ onSend, loading }: Props) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Ajustar altura del textarea automáticamente
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const triggerSend = async () => {
    if (!input.trim() || loading) return;

    const mensaje = input.trim();
    setInput(""); // Limpiamos UI inmediatamente para sensación de rapidez
    
    // Reseteamos la altura
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }

    await onSend(mensaje);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    triggerSend();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      triggerSend();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 border-t border-gray-100 bg-white w-full max-w-3xl mx-auto"
    >
      <div className="relative flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-black/5 focus-within:border-gray-300 transition-all shadow-sm">
        
       
        
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu mensaje..."
          rows={1}
          className="flex-1 max-h-[150px] min-h-[24px] bg-transparent border-none resize-none text-sm focus:ring-0 focus:outline-none py-2 leading-relaxed custom-scrollbar"
          disabled={loading && input.length === 0} // Solo deshabilitar si está vacío y cargando
        />

        <button
          type="submit"
          disabled={loading || !input.trim()}
          className={`
            flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all mb-0.5
            ${
              input.trim() && !loading
                ? "bg-black text-white hover:bg-gray-800 shadow-sm"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }
          `}
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} className={input.trim() ? "ml-0.5" : ""} />
          )}
        </button>
      </div>

      <p className="text-[10px] text-gray-400 mt-2 text-center font-medium">
        Presiona <kbd className="font-sans bg-gray-100 px-1 rounded border border-gray-200">Enter</kbd> para enviar
      </p>
    </form>
  );
}