import { AdminRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

type SessionUserIdentity = {
  id?: string | null;
  email?: string | null;
};

function getBootstrapCredentials() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "System Admin";

  if (!email || !password) {
    return null;
  }

  return { email, password, name };
}

export async function ensureBootstrapAdmin(email: string) {
  const bootstrap = getBootstrapCredentials();

  if (!bootstrap || bootstrap.email !== email.trim().toLowerCase()) {
    return null;
  }

  const existing = await prisma.adminUser.findUnique({
    where: {
      email: bootstrap.email,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.adminUser.create({
    data: {
      email: bootstrap.email,
      name: bootstrap.name,
      role: AdminRole.SUPER_ADMIN,
      passwordHash: hashPassword(bootstrap.password),
    },
  });
}

export async function authenticateAdmin(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  await ensureBootstrapAdmin(normalizedEmail);

  const admin = await prisma.adminUser.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (!admin) {
    return null;
  }

  if (!verifyPassword(password, admin.passwordHash)) {
    return null;
  }

  return admin;
}

export async function resolveAdminFromSessionUser(user: SessionUserIdentity | null | undefined) {
  if (!user) {
    return null;
  }

  if (user.id) {
    const byId = await prisma.adminUser.findUnique({
      where: {
        id: user.id,
      },
    });

    if (byId) {
      return byId;
    }
  }

  const normalizedEmail = user.email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const bootstrapAdmin = await ensureBootstrapAdmin(normalizedEmail);
  if (bootstrapAdmin) {
    return bootstrapAdmin;
  }

  return prisma.adminUser.findUnique({
    where: {
      email: normalizedEmail,
    },
  });
}
