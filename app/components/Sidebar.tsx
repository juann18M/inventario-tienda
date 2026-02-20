"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  LogOut, 
  MessageSquare, 
  GitCompare,
  LayoutGrid,
  Bot,
  FileText
} from "lucide-react";
import { useSession } from "next-auth/react";

interface SidebarProps {
  // Se agrega el "?" para que sea opcional y no de error en otras páginas
  onCerrarSesion?: () => void;
}

export default function Sidebar({ onCerrarSesion }: SidebarProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const rol = String((session?.user as any)?.role || "").toLowerCase();

  // Mapeo de rutas dinámico
  const menuItems = [
    { name: "Inicio", icon: Home, path: "/", roles: ["admin", "empleado"] },
    { name: "Inventario", icon: Package, path: "/inventario", roles: ["admin", "empleado"] },
    { name: "Trasladar", icon: GitCompare, path: "/traslado", roles: ["admin"] },
    { name: "Ventas", icon: ShoppingCart, path: "/ventas", roles: ["admin", "empleado"] },
    { name: "Historial Ventas", icon: FileText, path: "/historial-ventas", roles: ["admin", "empleado"] },
    { name: "Apartados", icon: LayoutGrid, path: "/apartados", roles: ["admin", "empleado"] },
    { name: "Asistente", icon: Bot, path: "/asistente", roles: ["admin", "empleado"] },

    { name: "Reportes", icon: BarChart3, path: "/reportes", roles: ["admin"] },
  ];

  if (!session) return null;

  // Filtro de seguridad: Admin ve todo, Empleado solo lo permitido
  const filteredMenu = menuItems.filter(item => 
    rol === "admin" ? true : item.roles.includes("empleado")
  );

  return (
    <aside className="w-16 lg:w-64 bg-white border-r border-slate-100 flex flex-col min-h-screen sticky top-0 transition-all duration-300 z-40">
      
      {/* Logo */}
      <div className="p-4 lg:p-8 flex justify-center lg:justify-start">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-white text-[10px] font-black italic">B.</span>
          </div>
          <span className="hidden lg:block text-[11px] font-black uppercase tracking-[0.3em] text-black">
            Blacks Boutique
          </span>
        </Link>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-2 lg:px-4 space-y-1">
        <div className="px-4 mb-4 hidden lg:block">
          <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">
            Menú Principal
          </span>
        </div>

        {filteredMenu.map((item) => {
          const isActive = pathname === item.path;
          
          return (
            <Link
              key={item.name}
              href={item.path}
              className={`flex items-center justify-center lg:justify-start px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? "bg-black text-white shadow-lg shadow-black/20" 
                  : "text-slate-400 hover:text-black hover:bg-slate-50"
              }`}
            >
              <item.icon 
                className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400 group-hover:text-black"}`} 
                strokeWidth={2.5} 
              />
              <span className={`hidden lg:block ml-3 text-xs font-bold uppercase tracking-tight ${
                isActive ? "text-white" : "text-slate-400 group-hover:text-black"
              }`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer / Salida */}
      <div className="p-4 border-t border-slate-50">
        <button
          onClick={onCerrarSesion}
          className="w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" strokeWidth={2.5} />
          <span className="hidden lg:block">Finalizar</span>
        </button>
      </div>
    </aside>
  );
}