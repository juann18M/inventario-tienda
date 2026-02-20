import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const connection = await db.getConnection();

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const userRole = user.role?.toLowerCase();
    const trasladoId = params.id;

    // 🔒 Solo admin puede eliminar registros
    if (userRole !== "admin") {
      return NextResponse.json(
        { error: "Solo administradores pueden eliminar registros" },
        { status: 403 }
      );
    }

    // 🔹 Eliminar detalles primero
    await connection.execute(
      `DELETE FROM traslado_detalles WHERE traslado_id = ?`,
      [trasladoId]
    );

    // 🔹 Eliminar traslado
    await connection.execute(
      `DELETE FROM traslados WHERE id = ?`,
      [trasladoId]
    );

    return NextResponse.json({
      success: true,
      message: "Registro eliminado correctamente"
    });

  } catch (error) {
    console.error("❌ Error al eliminar traslado:", error);
    return NextResponse.json(
      { error: "Error al eliminar el registro" },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}
