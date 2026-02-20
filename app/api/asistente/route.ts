import { NextResponse } from "next/server"; 
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  let connection;
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const { mensaje } = await req.json();

    if (!mensaje) {
      return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
    }

    connection = await db.getConnection();
    
    const intencion = detectarIntencion(mensaje);
    let respuesta = "";
    let productos: any[] = [];
    let tipoRespuesta = "texto";

    if (intencion === "no_reconocido") {
      respuesta = obtenerMensajeNoReconocido();
    } else {
      switch (intencion) {
        case "buscar_producto":
          const resultado = await buscarProducto(connection, mensaje);
          respuesta = resultado.texto;
          productos = resultado.productos;
          tipoRespuesta = productos.length > 0 ? "productos" : "texto";
          break;
        
        case "sin_stock":
          respuesta = await consultarSinStock(connection);
          break;
        
        case "stock_bajo":
          respuesta = await consultarStockBajo(connection);
          break;
        
        case "resumen":
          respuesta = await resumenGeneral(connection);
          break;
        
        case "valor_inventario":
          respuesta = await valorInventario(connection);
          break;
        
        case "total_productos":
          respuesta = await totalProductos(connection);
          break;
        
        case "stock_marca":
          respuesta = await stockPorMarca(connection, mensaje);
          break;
        
        case "top_productos":
          respuesta = await topProductos(connection);
          break;
        
        case "productos_sucursal":
          respuesta = await productosPorSucursal(connection, mensaje);
          break;
        
        case "ayuda":
          respuesta = obtenerAyudaCompleta();
          break;
        
        case "saludo":
          respuesta = "Hola. ¿En qué puedo ayudarte hoy?\n\n---\n\n" + obtenerListaComandos();
          break;
      }
    }

    await guardarConversacion(connection, user, mensaje, respuesta, intencion);

    return NextResponse.json({
      success: true,
      tipo: tipoRespuesta,
      respuesta: respuesta,
      productos: productos
    });

  } catch (error: any) {
    console.error("Error en el asistente:", error);
    return NextResponse.json(
      { error: "Error interno", message: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.release();
  }
}

// ==================== FUNCIONES DE AYUDA Y BIENVENIDA ====================

function obtenerMensajeNoReconocido(): string {
  return `### Petición no reconocida
No logré entender tu consulta. Por favor, intenta usar alguno de los comandos predeterminados o busca directamente un producto.

**Ejemplos de búsqueda rápida:**
- "playera nike"
- "stock bajo"
- "productos sin stock"
- "resumen general"
- "qué hay en Centro"

Escribe **"ayuda"** para ver todas mis funciones.`;
}

function obtenerListaComandos(): string {
  return `### Comandos Disponibles

**1. Búsquedas Específicas**
- Por nombre: "playera", "tenis", "camisa"
- Por SKU: "7865", "ABC123"
- Por característica: "M", "BLANCO"

**2. Reportes de Inventario**
- **"stock bajo"**: Muestra productos con 5 unidades o menos.
- **"sin stock"**: Muestra el listado de productos agotados.
- **"resumen"**: Despliega el estado general del inventario.
- **"valor inventario"**: Calcula el valor total por sucursal.
- **"total productos"**: Indica la cantidad de productos registrados.
- **"top productos"**: Muestra los artículos con mayor volumen de stock.

**3. Consultas por Ubicación y Marca**
- **Sucursales**: "en Centro Isidro Huarte", "en Santiago Tapia", "en Guadalupe Victoria".
- **Marcas**: "stock marca nike", "productos de la marca adidas".`;
}

function obtenerAyudaCompleta(): string {
  return `### Asistente Virtual: Centro de Ayuda
  
Puedes interactuar conmigo usando lenguaje natural o palabras clave concretas.

${obtenerListaComandos()}

**Sugerencia de uso:** Intenta con frases como *"¿Hay playeras Nike en Centro?"* o *"Cuánto vale todo el inventario"*.`;
}

// ==================== DETECCIÓN DE INTENCIÓN ====================

function detectarIntencion(mensaje: string): string {
  const msg = mensaje.toLowerCase().trim();
  
  if (!msg || msg.length < 2) return "no_reconocido";

  const patrones = [
    { palabras: ["hola", "buenas", "que onda", "buenos días", "buenas tardes"], intencion: "saludo" },
    { palabras: ["ayuda", "comandos", "puedes hacer", "funciones", "que sabes"], intencion: "ayuda" },
    { palabras: ["sin stock", "agotado", "no hay", "0 stock", "cero"], intencion: "sin_stock" },
    { palabras: ["stock bajo", "poco stock", "menos de 5", "por agotarse"], intencion: "stock_bajo" },
    { palabras: ["resumen", "general", "panorama", "estado actual"], intencion: "resumen" },
    { palabras: ["valor inventario", "cuanto vale", "valor total", "dinero invertido"], intencion: "valor_inventario" },
    { palabras: ["total productos", "cuántos productos", "cantidad de productos"], intencion: "total_productos" },
    { palabras: ["top productos", "mas stock", "más unidades", "productos con más"], intencion: "top_productos" },
    { palabras: ["stock marca", "productos de la marca", "marca nike", "marca adidas"], intencion: "stock_marca" },
    { palabras: ["sucursal", "en centro", "en santiago", "en guadalupe", "huarte", "tapia", "victoria"], intencion: "productos_sucursal" }
  ];

  for (const patron of patrones) {
    if (patron.palabras.some(palabra => msg.includes(palabra))) {
      return patron.intencion;
    }
  }

  if (msg.length > 3) return "buscar_producto";

  return "no_reconocido";
}

// ==================== BÚSQUEDA DE PRODUCTOS ====================

async function buscarProducto(connection: any, mensaje: string): Promise<{texto: string, productos: any[]}> {
  const terminoBusqueda = mensaje.toLowerCase().trim();

  const [rows]: any = await connection.execute(
    `SELECT p.id, p.nombre, p.sku, p.stock, p.precio, p.talla, p.color, p.imagen, p.sucursal
     FROM productos p
     WHERE LOWER(p.nombre) LIKE ? 
        OR LOWER(p.sku) LIKE ?
        OR LOWER(p.talla) LIKE ?
        OR LOWER(p.color) LIKE ?
     ORDER BY 
       CASE 
         WHEN LOWER(p.nombre) LIKE ? THEN 1
         WHEN LOWER(p.sku) LIKE ? THEN 2
         ELSE 3
       END,
       p.stock DESC`,
    Array(6).fill(`%${terminoBusqueda}%`)
  );

  if (rows.length === 0) {
    return {
      texto: `### Búsqueda sin resultados\n\nNo encontré ningún producto coincidente con **"${terminoBusqueda}"**.\n\n**Sugerencias:**\n- Verifica la ortografía.\n- Usa términos más generales.\n- Intenta buscar por código SKU.`,
      productos: []
    };
  }

  const productosProcesados = rows.map((p: any) => {
    if (p.imagen && !p.imagen.startsWith("/uploads/") && !p.imagen.startsWith("http") && !p.imagen.startsWith("data:")) {
      p.imagen = p.imagen.replace(/^\/+/, "");
    }
    return p;
  });

  const productosConStock = productosProcesados.filter((p: any) => p.stock > 0);
  const productosSinStock = productosProcesados.filter((p: any) => p.stock === 0);

  let texto = "";
  
  if (productosConStock.length > 0) {
    texto += `### Resultados de la búsqueda: ${productosConStock.length} producto(s)\n\n`;
    
    const porSucursal: any = {};
    productosConStock.forEach((p: any) => {
      if (!porSucursal[p.sucursal]) porSucursal[p.sucursal] = [];
      porSucursal[p.sucursal].push(p);
    });

    for (const [sucursal, prods] of Object.entries(porSucursal)) {
      texto += `**${sucursal}**\n`;
      
      (prods as any[]).forEach((p: any) => {
        const detalles = [p.talla, p.color].filter(Boolean).join(" - ");
        const infoExtra = detalles ? ` [${detalles}]` : "";
        texto += `- ${p.nombre}${infoExtra}\n  SKU: ${p.sku} | Stock: ${p.stock} | Precio: $${p.precio}\n\n`;
      });
    }
  }

  if (productosSinStock.length > 0) {
    texto += `---\n\n### Artículos sin stock (${productosSinStock.length})\n\n`;
    
    const sinStockPorSucursal: any = {};
    productosSinStock.forEach((p: any) => {
      if (!sinStockPorSucursal[p.sucursal]) sinStockPorSucursal[p.sucursal] = [];
      sinStockPorSucursal[p.sucursal].push(p);
    });

    for (const [sucursal, prods] of Object.entries(sinStockPorSucursal)) {
      texto += `**${sucursal}:** ${(prods as any[]).map(p => p.nombre).join(', ')}\n`;
    }
  }

  return { texto: texto.trim(), productos: productosConStock };
}

// ==================== REPORTES ====================

async function consultarSinStock(connection: any): Promise<string> {
  const [rows]: any = await connection.execute(
    `SELECT nombre, sucursal, sku FROM productos WHERE stock = 0 ORDER BY sucursal, nombre`
  );

  if (!rows.length) {
    return "### Todo en orden\n\nNo hay productos agotados en este momento. El inventario cuenta con stock disponible en todas sus líneas.";
  }

  let respuesta = `### Reporte: Productos sin stock\n**Total agotados:** ${rows.length} artículos\n\n`;
  
  const porSucursal: any = {};
  rows.forEach((p: any) => {
    if (!porSucursal[p.sucursal]) porSucursal[p.sucursal] = [];
    porSucursal[p.sucursal].push(p);
  });

  for (const [sucursal, prods] of Object.entries(porSucursal)) {
    respuesta += `**${sucursal}**\n`;
    (prods as any[]).forEach((p: any) => {
      respuesta += `- ${p.nombre} (SKU: ${p.sku})\n`;
    });
    respuesta += `\n`;
  }

  respuesta += `*Se recomienda revisar estas líneas para considerar un posible reabastecimiento.*`;
  return respuesta;
}

async function consultarStockBajo(connection: any): Promise<string> {
  const [rows]: any = await connection.execute(
    `SELECT p.nombre, p.sku, p.stock, p.sucursal
     FROM productos p
     WHERE p.stock <= 5 AND p.stock > 0
     ORDER BY p.stock ASC, p.sucursal`
  );

  if (rows.length === 0) {
    return "### Inventario saludable\n\nNo hay productos con stock bajo (5 unidades o menos) en este momento.";
  }

  const porSucursal: any = {};
  rows.forEach((p: any) => {
    if (!porSucursal[p.sucursal]) porSucursal[p.sucursal] = [];
    porSucursal[p.sucursal].push(p);
  });

  let respuesta = `### Reporte: Productos con stock bajo\n**Total a reabastecer:** ${rows.length} artículos\n\n`;
  
  for (const [sucursal, productos] of Object.entries(porSucursal)) {
    respuesta += `**${sucursal}**\n`;
    
    (productos as any[]).forEach((p: any) => {
      const prioridad = p.stock <= 2 ? "**(Prioridad Alta)**" : "";
      respuesta += `- ${p.nombre} ${prioridad}\n  SKU: ${p.sku} | Quedan: ${p.stock}\n\n`;
    });
  }

  return respuesta.trim();
}

async function resumenGeneral(connection: any): Promise<string> {
  const [[productos]]: any = await connection.execute(`SELECT COUNT(*) as total FROM productos`);
  const [[unidades]]: any = await connection.execute(`SELECT SUM(stock) as total FROM productos`);
  const [[sinStock]]: any = await connection.execute(`SELECT COUNT(*) as total FROM productos WHERE stock = 0`);
  const [[stockBajo]]: any = await connection.execute(`SELECT COUNT(*) as total FROM productos WHERE stock <= 5 AND stock > 0`);

  const [porSucursal]: any = await connection.execute(
    `SELECT sucursal, COUNT(*) as productos, SUM(stock) as unidades
     FROM productos GROUP BY sucursal ORDER BY sucursal`
  );

  let respuesta = `### Resumen General del Inventario\n\n`;
  
  respuesta += `**Métricas Globales**\n`;
  respuesta += `- **Variedad de productos:** ${productos.total}\n`;
  respuesta += `- **Unidades físicas totales:** ${unidades.total || 0}\n`;
  respuesta += `- **Artículos sin stock:** ${sinStock.total}\n`;
  respuesta += `- **Artículos con stock bajo:** ${stockBajo.total}\n\n`;
  
  respuesta += `**Distribución por Sucursal**\n`;
  porSucursal.forEach((s: any) => {
    respuesta += `- **${s.sucursal}:** ${s.unidades} unidades (${s.productos} productos diferentes)\n`;
  });

  return respuesta;
}

async function valorInventario(connection: any): Promise<string> {
  const [rows]: any = await connection.execute(
    `SELECT sucursal, SUM(stock * precio) as total
     FROM productos GROUP BY sucursal ORDER BY total DESC`
  );

  let totalGeneral = 0;
  let respuesta = `### Valorización del Inventario\n\n`;

  rows.forEach((r: any) => {
    const valor = parseFloat(r.total) || 0;
    totalGeneral += valor;
    respuesta += `- **${r.sucursal}:** $${valor.toLocaleString('es-MX', { minimumFractionDigits: 2 })}\n`;
  });

  respuesta += `\n---\n**Total General:** $${totalGeneral.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
  return respuesta;
}

async function totalProductos(connection: any): Promise<string> {
  const [[productos]]: any = await connection.execute(`SELECT COUNT(*) as total FROM productos`);
  const [[marcas]]: any = await connection.execute(
    `SELECT COUNT(DISTINCT CASE 
       WHEN nombre LIKE '%NIKE%' THEN 'NIKE'
       WHEN nombre LIKE '%ADIDAS%' THEN 'ADIDAS'
       WHEN nombre LIKE '%PUMA%' THEN 'PUMA'
       ELSE 'OTROS'
     END) as total FROM productos`
  );
  const [[unidades]]: any = await connection.execute(`SELECT SUM(stock) as total FROM productos`);

  return `### Estadísticas de Registro\n\n- **Catálogo:** ${productos.total} productos diferentes.\n- **Volumen:** ${unidades.total || 0} unidades físicas en total.\n- **Marcas detectadas:** ${marcas.total} (Principales y otras).`;
}

async function stockPorMarca(connection: any, mensaje: string): Promise<string> {
  const marca = mensaje.replace(/stock marca|productos de la marca|marca/gi, "").trim();

  if (!marca) {
    return `### Marca requerida\n\nPor favor especifica la marca que deseas consultar. \n\n**Ejemplo:** *"stock marca nike"*`;
  }

  const [rows]: any = await connection.execute(
    `SELECT sucursal, SUM(stock) as total, COUNT(*) as productos
     FROM productos WHERE LOWER(nombre) LIKE ? GROUP BY sucursal ORDER BY total DESC`,
    [`%${marca.toLowerCase()}%`]
  );

  if (!rows.length) {
    return `### Marca no encontrada\n\nNo hay registros asociados a la marca **"${marca.toUpperCase()}"** en este momento.`;
  }

  let totalGeneral = 0;
  let respuesta = `### Inventario: Marca ${marca.toUpperCase()}\n\n`;
  
  rows.forEach((r: any) => {
    totalGeneral += parseInt(r.total) || 0;
    respuesta += `**${r.sucursal}**\n- Productos diferentes: ${r.productos}\n- Unidades físicas: ${r.total}\n\n`;
  });

  respuesta += `---\n**Total de la marca:** ${totalGeneral} unidades.`;
  return respuesta;
}

async function topProductos(connection: any): Promise<string> {
  const [rows]: any = await connection.execute(
    `SELECT nombre, SUM(stock) as total, COUNT(DISTINCT sucursal) as sucursales
     FROM productos GROUP BY nombre ORDER BY total DESC LIMIT 10`
  );

  let respuesta = `### Top 10: Productos con Mayor Stock\n\n`;

  rows.forEach((p: any, i: number) => {
    respuesta += `**${i + 1}. ${p.nombre}**\n- Unidades: ${p.total} (Distribuido en ${p.sucursales} sucursal/es)\n\n`;
  });

  return respuesta.trim();
}

async function productosPorSucursal(connection: any, mensaje: string): Promise<string> {
  const msg = mensaje.toLowerCase();
  let sucursal = "";
  
  if (msg.includes("centro") || msg.includes("huarte")) {
    sucursal = (msg.includes("2") || msg.includes("dos")) ? "Centro Isidro Huarte 2" : "Centro Isidro Huarte 1";
  } else if (msg.includes("santiago") || msg.includes("tapia")) {
    sucursal = "Santiago Tapia";
  } else if (msg.includes("guadalupe") || msg.includes("victoria")) {
    sucursal = "Guadalupe Victoria";
  }

  if (!sucursal) {
    return `### Sucursal no reconocida\n\nPor favor especifica una de las sucursales válidas:\n- Centro Isidro Huarte 1\n- Centro Isidro Huarte 2\n- Santiago Tapia\n- Guadalupe Victoria`;
  }

  const [rows]: any = await connection.execute(
    `SELECT p.nombre, p.sku, p.stock, p.precio, p.talla, p.color
     FROM productos p WHERE p.sucursal = ? AND p.stock > 0 ORDER BY p.stock DESC, p.nombre`,
    [sucursal]
  );

  if (rows.length === 0) {
    return `### ${sucursal}\n\nActualmente no hay productos con disponibilidad de stock en esta ubicación.`;
  }

  const totalStock = rows.reduce((sum: number, p: any) => sum + p.stock, 0);

  let respuesta = `### Reporte de Sucursal: ${sucursal}\n\n`;
  respuesta += `**Métricas:** ${rows.length} productos diferentes | ${totalStock} unidades en total\n\n---\n\n`;
  
  rows.slice(0, 15).forEach((p: any) => {
    const detalles = [p.talla, p.color].filter(Boolean).join(" - ");
    const infoExtra = detalles ? ` [${detalles}]` : "";
    respuesta += `- **${p.nombre}**${infoExtra}\n  SKU: ${p.sku} | Stock: ${p.stock} | Precio: $${p.precio}\n\n`;
  });

  if (rows.length > 15) {
    respuesta += `*(Se omitieron ${rows.length - 15} productos de la lista para facilitar la lectura. Usa la búsqueda específica si necesitas un producto particular).*`;
  }

  return respuesta.trim();
}

// ==================== GUARDAR CONVERSACIÓN ====================

async function guardarConversacion(connection: any, user: any, mensaje: string, respuesta: string, intencion: string) {
  try {
    let sucursalId = 1;
    if (user.sucursal) {
      const [sucursalRows]: any = await connection.execute(
        `SELECT id FROM sucursales WHERE nombre = ?`,
        [user.sucursal]
      );
      if (sucursalRows.length) sucursalId = sucursalRows[0].id;
    }

    const [convRows]: any = await connection.execute(
      `SELECT id FROM asistente_conversaciones WHERE usuario_id = ? AND activa = 1 LIMIT 1`,
      [user.id]
    );

    let conversacionId;
    if (convRows.length) {
      conversacionId = convRows[0].id;
    } else {
      const [newConv]: any = await connection.execute(
        `INSERT INTO asistente_conversaciones (usuario_id, sucursal_id) VALUES (?, ?)`,
        [user.id, sucursalId]
      );
      conversacionId = newConv.insertId;
    }

    await connection.execute(
      `INSERT INTO asistente_mensajes (conversacion_id, tipo, mensaje, intencion) VALUES (?, 'usuario', ?, ?)`,
      [conversacionId, mensaje, intencion]
    );

  } catch (error) {
    console.error("Error al registrar el historial de chat:", error);
  }
}