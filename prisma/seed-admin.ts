/**
 * Seed d'un compte ADMIN de test / bootstrap.
 *
 * L'inscription publique (/auth/register) ne crée que des EMPLOYEE : ce script est
 * le seul moyen de créer le tout premier ADMIN (problème de l'œuf et de la poule).
 *
 * Utilisation :
 *   ADMIN_EMAIL=admin@forge.dev ADMIN_PASSWORD='MotDePasseFort123' npx ts-node prisma/seed-admin.ts
 *
 * Valeurs par défaut si les variables ne sont pas fournies (à ne PAS utiliser en prod tel quel).
 * Le script est idempotent : si l'email existe déjà, le compte est promu ADMIN.
 */
import 'dotenv/config';
import { PrismaClient, Role, Department } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

async function main() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@forge.dev';
  const password = process.env.ADMIN_PASSWORD ?? 'ChangeMoi123!';
  const firstName = process.env.ADMIN_FIRSTNAME ?? 'Admin';
  const lastName = process.env.ADMIN_LASTNAME ?? 'Forge';

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.user.upsert({
      where: { email },
      update: {
        role: Role.ADMIN,
        password: hashedPassword,
        deletedAt: null,
      },
      create: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role: Role.ADMIN,
        department: Department.ADMINISTRATION,
      },
      select: { id: true, email: true, role: true },
    });

    console.log('✓ Admin prêt :', admin.email, `(${admin.role}, id=${admin.id})`);
    console.log('  Mot de passe :', password);
    console.log('  → Change-le après la première connexion.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Échec du seed admin :', err);
  process.exit(1);
});
