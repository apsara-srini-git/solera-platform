import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
(async () => {
  const since = new Date(Date.now() - 45 * 60 * 1000);
  const invs = await db.invitation.findMany({ where: { submittedAt: { gte: since } }, select: { id: true, submittedAt: true, shortlistItem: { select: { stage: true, decidedAt: true, project: { select: { id: true, user: { select: { email: true } } } } } } } });
  console.log(JSON.stringify(invs, null, 1));
  await db.$disconnect();
})();
