"use client";

import { User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown"; // Necesitarás instalar: npm install react-markdown remark-gfm

interface Props {
  tipo: "usuario" | "sistema";
  mensaje: string;
  fecha?: string;
}

export default function MessageBubble({ tipo, mensaje, fecha }: Props) {
  const isUser = tipo === "usuario";

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-2`}>
      <div 
        className={`flex max-w-[85%] md:max-w-[75%] ${
          isUser ? "flex-row-reverse" : "flex-row"
        } gap-3 items-end animate-in fade-in slide-in-from-bottom-1 duration-300`}
      >
        
        {/* Avatar con gradiente para el Bot */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm ${
          isUser 
            ? "bg-white border border-gray-200" 
            : "bg-gradient-to-tr from-blue-600 to-indigo-600"
        }`}>
          {isUser ? (
            <User size={16} className="text-gray-600" />
          ) : (
            <Bot size={16} className="text-white" />
          )}
        </div>

        {/* Contenedor del Mensaje */}
        <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
          <div
            className={`px-4 py-3 rounded-2xl text-sm shadow-sm leading-relaxed ${
              isUser
                ? "bg-slate-900 text-white rounded-br-none"
                : "bg-white border border-gray-100 text-slate-800 rounded-bl-none"
            }`}
          >
            {/* Renderizado de Markdown para interpretar la respuesta del backend */}
            <div className={`prose prose-sm max-w-none ${isUser ? "prose-invert" : "prose-slate"}`}>
              <ReactMarkdown 
                components={{
                  // Ajuste de márgenes para que los títulos y listas no ocupen demasiado espacio
                  h3: ({node, ...props}) => <h3 className="text-base font-bold mb-1 mt-0" {...props} />,
                  p: ({node, ...props}) => <p className="mb-2 last:mb-0 inline-block" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc ml-4 mb-2" {...props} />,
                  li: ({node, ...props}) => <li className="mb-0.5" {...props} />,
                }}
              >
                {mensaje}
              </ReactMarkdown>
            </div>
          </div>

          {/* Fecha/Hora */}
          {fecha && (
            <div className="flex items-center gap-1 mt-1 px-1">
              <span className="text-[10px] text-gray-400 font-medium uppercase">
                {new Date(fecha).toLocaleTimeString('es-MX', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}