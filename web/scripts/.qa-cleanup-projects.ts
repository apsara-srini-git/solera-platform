// TEMPORARY (delete after use): removes qa-proj-* test users and everything they created.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
(async () => {
  const users = await db.user.findMany({ where: { email: { startsWith: "qa-proj-", endsWith: "@example-test.org" } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  const projects = await db.project.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const projectIds = projects.map((p) => p.id);
  const invs = await db.invitation.findMany({ where: { shortlistItem: { projectId: { in: projectIds } } }, select: { id: true } });
  const r = {
    siteAnswers: (await db.siteAnswer.deleteMany({ where: { sourceInvitationId: { in: invs.map((i) => i.id) } } })).count,
    emailLogs: (await db.emailLog.deleteMany({ where: { projectId: { in: projectIds } } })).count,
    uploads: (await db.protocolUpload.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { projectId: { in: projectIds } }] } })).count,
    libraryQs: (await db.libraryQuestion.deleteMany({ where: { createdByUserId: { in: userIds } } })).count,
    users: (await db.user.deleteMany({ where: { id: { in: userIds } } })).count,
  };
  const left = await db.project.count({ where: { id: { in: projectIds } } });
  console.log(JSON.stringify({ ...r, projects: projectIds.length, projectsLeft: left, emails: users.map((u) => u.email) }));
  await db.$disconnect();
})();
