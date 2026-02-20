import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        correo: { label: "Correo", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.correo || !credentials?.password) return null;

        const [rows]: any = await db.query(
          `
          SELECT 
            u.id,
            u.nombre,
            u.correo,
            u.password,
            u.rol,
            u.sucursal_id,
            s.nombre AS sucursal_nombre
          FROM usuarios u
          LEFT JOIN sucursales s ON u.sucursal_id = s.id
          WHERE u.correo = ?
          LIMIT 1
          `,
          [credentials.correo]
        );

        const user = rows[0];
        if (!user) return null;

        const ok = await bcrypt.compare(credentials.password, user.password);
        if (!ok) return null;

        return {
          id: String(user.id),
          name: user.nombre,
          email: user.correo,
          role: user.rol,
          sucursal_id: user.sucursal_id,
          sucursal_nombre: user.sucursal_nombre,
        };
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.sucursal_id = (user as any).sucursal_id;
        token.sucursal_nombre = (user as any).sucursal_nombre;
      }
      return token;
    },

    async session({ session, token }: any) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.sucursal_id = token.sucursal_id;
      session.user.sucursal_nombre = token.sucursal_nombre;
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};
