"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import Sidebar from "../components/Sidebar";
import ChatContainer from "./components/ChatContainer";
import { useAsistente } from "./hooks/useAsistente";

export default function AsistentePage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const {
    mensajes,
    enviarMensaje,
    loading,
    reiniciar,
  } = useAsistente();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      
      {/* --- OVERLAY MÓVIL --- */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/60 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* --- SIDEBAR RESPONSIVO --- */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-30 w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out shadow-xl lg:shadow-none
          lg:static lg:translate-x-0 
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <Sidebar />
      </aside>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <main className="flex-1 flex flex-col h-full relative w-full">
        
        {/* === HEADER CON LOGO ROBOT === */}
        <header className="bg-white h-16 border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 flex-shrink-0 relative z-10">
          <div className="flex items-center gap-3 lg:gap-4">
            {/* Botón Hamburguesa (Solo Móvil) */}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 rounded-md hover:bg-gray-100 text-gray-700 lg:hidden transition-colors"
              aria-label="Abrir menú"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>

            {/* --- LOGO MARCA --- */}
            <Link href="/" className="flex items-center gap-2 group">
              {/* Icono Robot SVG */}
              <div className="bg-gray-900 text-white p-1.5 rounded-lg group-hover:bg-indigo-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path d="M16.5 6V4.5a1.5 1.5 0 0 0-3 0V6h-3V4.5a1.5 1.5 0 0 0-3 0V6H6a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-1.5ZM9 4.5a.5.5 0 0 1 1 0V6H9V4.5Zm6 0a.5.5 0 0 1 1 0V6h-1V4.5ZM9 13.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm6 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm-3 4.5a3.003 3.003 0 0 1-2.83-2h5.66a3.003 3.003 0 0 1-2.83 2Z"/>
                </svg>
              </div>
              
              {/* Texto BLACKY */}
              <h1 className="text-2xl font-black uppercase tracking-tighter text-gray-900 select-none flex items-baseline relative top-[1px]">
                BLACKY
                <span className="text-indigo-600 ml-0.5 text-sm font-bold tracking-normal">AI</span>
              </h1>
            </Link>
          </div>

          {/* Estado (Opcional) */}
          <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-100">
             <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
             <span className="hidden sm:block">Online</span>
          </div>
        </header>

        {/* ÁREA DE CHAT */}
        <div className="flex-1 overflow-hidden relative bg-gray-50/50">
          <div className="h-full max-w-5xl mx-auto w-full flex flex-col p-3 md:p-6">
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden flex flex-col backdrop-blur-sm">
              <ChatContainer
                mensajes={mensajes}
                onSend={enviarMensaje}
                onReset={reiniciar}
                loading={loading}
              />
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}