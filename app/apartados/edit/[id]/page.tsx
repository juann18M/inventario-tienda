"use client";

import { useParams } from "next/navigation";

export default function EditApartadoPage() {
  const params = useParams();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Editar Apartado</h1>
      <p className="text-gray-500 mt-2">
        Editando apartado ID: {params?.id}
      </p>
    </div>
  );
}