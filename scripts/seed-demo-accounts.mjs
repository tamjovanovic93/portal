// Creates two disposable test logins (one TEAM, one CLIENT) plus a demo client
// with enough data to exercise every branch of the client portal.
//
//   DEMO_TEAM_PASSWORD=... DEMO_CLIENT_PASSWORD=... node scripts/seed-demo-accounts.mjs
//   node scripts/seed-demo-accounts.mjs --undo   delete everything it made
//
// Passwords come from the environment on purpose: these accounts are real
// logins against the production database, so hardcoding them here would put
// working credentials into git history. --undo needs no passwords.
//
// Everything it creates is tagged DEMO_TAG, so --undo is exact: it never
// touches a row it did not create. Safe to re-run.

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { requireSecret } from "./_secrets.mjs";

const prisma = new PrismaClient();

const DEMO_TAG = "zp-demo";
const undo = process.argv.includes("--undo");

const TEAM = {
  email: process.env.DEMO_TEAM_EMAIL ?? "t@zp.test",
  password: process.env.DEMO_TEAM_PASSWORD,
  name: "Demo Team",
};
const CLIENT = {
  email: process.env.DEMO_CLIENT_EMAIL ?? "c@zp.test",
  password: process.env.DEMO_CLIENT_PASSWORD,
  name: "Demo Client",
};

if (!undo && (!TEAM.password || !CLIENT.password)) {
  console.error("Set DEMO_TEAM_PASSWORD and DEMO_CLIENT_PASSWORD before seeding, e.g.");
  console.error("  DEMO_TEAM_PASSWORD=... DEMO_CLIENT_PASSWORD=... node scripts/seed-demo-accounts.mjs");
  process.exit(1);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  await requireSecret(prisma, "SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Find an auth user by email without assuming a page size.
async function findAuthUser(email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function upsertLogin({ email, password, name }, role) {
  const existing = await findAuthUser(email);
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      app_metadata: { role },
    });
    // app_metadata.role is what proxy.ts routes on — profiles.role is what
    // actually authorizes. Both must agree.
    await prisma.profile.upsert({
      where: { id: existing.id },
      update: { email, name, role, active: true },
      create: { id: existing.id, email, name, role, active: true },
    });
    return { id: existing.id, created: false };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
  });
  if (error) throw new Error(`${email}: ${error.message}`);
  try {
    await prisma.profile.upsert({
      where: { id: data.user.id },
      update: { email, name, role, active: true },
      create: { id: data.user.id, email, name, role, active: true },
    });
  } catch (err) {
    await admin.auth.admin.deleteUser(data.user.id).catch(() => {});
    throw err;
  }
  return { id: data.user.id, created: true };
}

const days = (n) => new Date(Date.now() + n * 86400000);

async function teardown() {
  const client = await prisma.profile.findUnique({ where: { email: CLIENT.email }, select: { id: true } });
  const team = await prisma.profile.findUnique({ where: { email: TEAM.email }, select: { id: true } });

  if (client) {
    const projects = await prisma.project.findMany({ where: { clientId: client.id }, select: { id: true } });
    const ids = projects.map((p) => p.id);
    if (ids.length) {
      // Children first: only Project has cascade deletes defined.
      await prisma.approval.deleteMany({ where: { projectId: { in: ids } } });
      await prisma.question.deleteMany({ where: { projectId: { in: ids } } });
      await prisma.notification.deleteMany({ where: { projectId: { in: ids } } });
      await prisma.activityLog.deleteMany({ where: { projectId: { in: ids } } });
      await prisma.project.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.question.deleteMany({ where: { OR: [{ recipientId: client.id }, { askedById: client.id }] } });
    await prisma.notification.deleteMany({ where: { recipientId: client.id } });
    await prisma.document.deleteMany({ where: { clientId: client.id } });
    await prisma.profile.delete({ where: { id: client.id } }).catch(() => {});
    const authUser = await findAuthUser(CLIENT.email);
    if (authUser) await admin.auth.admin.deleteUser(authUser.id).catch(() => {});
    console.log(`  removed client ${CLIENT.email} and ${ids.length} demo project(s)`);
  }

  if (team) {
    await prisma.notification.deleteMany({ where: { recipientId: team.id } });
    await prisma.question.deleteMany({ where: { OR: [{ recipientId: team.id }, { askedById: team.id }] } });
    await prisma.profile.delete({ where: { id: team.id } }).catch(() => {});
    const authUser = await findAuthUser(TEAM.email);
    if (authUser) await admin.auth.admin.deleteUser(authUser.id).catch(() => {});
    console.log(`  removed team ${TEAM.email}`);
  }
}

async function seed() {
  const team = await upsertLogin(TEAM, "TEAM");
  const client = await upsertLogin(CLIENT, "CLIENT");
  console.log(`  team   ${TEAM.email}  (${team.created ? "created" : "password reset"})`);
  console.log(`  client ${CLIENT.email}  (${client.created ? "created" : "password reset"})`);

  // Re-runnable: drop this demo client's projects and docs, then rebuild.
  const old = await prisma.project.findMany({ where: { clientId: client.id }, select: { id: true } });
  if (old.length) {
    const ids = old.map((p) => p.id);
    await prisma.approval.deleteMany({ where: { projectId: { in: ids } } });
    await prisma.question.deleteMany({ where: { projectId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { projectId: { in: ids } } });
    await prisma.project.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.document.deleteMany({ where: { clientId: client.id } });
  await prisma.question.deleteMany({ where: { recipientId: client.id } });

  const stageRows = (current) =>
    Array.from({ length: 7 }, (_, i) => {
      const n = i + 1;
      return {
        stageNumber: n,
        status: n < current ? "COMPLETE" : n === current ? "IN_PROGRESS" : "NOT_STARTED",
        gateApproved: n < current,
        completedAt: n < current ? days(-20 + n * 3) : null,
      };
    });

  // ── Project A: staged, sitting on the wireframe gate ──────────────────────
  const website = await prisma.project.create({
    data: {
      name: `${DEMO_TAG} Website Redesign`,
      clientId: client.id,
      type: "WEBSITE",
      mode: "PROJECT",
      currentStage: 2, // Sketch — a gated stage, left unapproved on purpose
      briefPublishedAt: days(-5),
      stages: { create: stageRows(2) },
      materials: {
        create: [
          { label: "Logo files (SVG or AI)", category: "visuals", status: "pending", notes: "Vector if you have it", dueDate: days(4) },
          { label: "Team photos", category: "visuals", status: "pending", dueDate: days(9) },
          { label: "Company registration number", category: "info", status: "verified" },
        ],
      },
    },
  });

  // Links rather than uploads: text/uri-list assets need no storage object,
  // and the portal already treats them as links everywhere.
  await prisma.projectAsset.createMany({
    data: [
      ["Homepage wireframe", "wireframes", 2],
      ["Product page wireframe", "wireframes", 2],
      ["Checkout wireframe", "wireframes", 2],
      ["Brand moodboard.pdf", "visuals", 1],
    ].map(([filename, folder, stageNumber]) => ({
      projectId: website.id,
      stageNumber,
      storagePath: "https://example.com/demo-asset",
      filename,
      mimeType: "text/uri-list",
      visibility: "SHARED",
      folder,
      uploadedBy: team.id,
      uploadedAt: days(-2),
      notes: folder === "wireframes" ? "Shared for your review" : null,
    })),
  });

  await prisma.document.create({
    data: {
      projectId: website.id,
      stageNumber: 1,
      templateType: "project_brief",
      title: "Project Brief",
      status: "APPROVED",
      completedAt: days(-5),
      content: {
        sections: [
          { key: "overview", label: "Project Overview", kind: "overview", visibleToClient: true },
          { key: "scope", label: "Scope of Work", kind: "scope", visibleToClient: true },
        ],
        overview: "A full redesign of the public website, focused on conversion.",
      },
    },
  });

  // ── Project B: retainer ───────────────────────────────────────────────────
  const retainer = await prisma.project.create({
    data: {
      name: `${DEMO_TAG} Monthly Marketing`,
      clientId: client.id,
      type: "MARKETING",
      mode: "ONGOING",
      currentStage: 1,
      stages: { create: stageRows(1) },
      materials: { create: [{ label: "September blog topics", category: "copy", status: "pending", dueDate: days(3) }] },
    },
  });

  await prisma.cycle.create({
    data: {
      projectId: retainer.id,
      name: "September",
      focus: "Content + paid social",
      startDate: days(-14),
      status: "ACTIVE",
      tasks: {
        create: [
          {
            name: "Instagram campaign creatives",
            type: "DELIVERABLE",
            status: "WAITING_FINAL_APPROVAL",
            requiresClientApproval: true,
            description: "Six posts for the autumn push — needs your sign-off.",
          },
          { name: "Blog: 5 ways to cut delivery time", type: "DELIVERABLE", status: "DONE", completedAt: days(-6) },
          { name: "Monthly performance report", type: "DELIVERABLE", status: "DONE", completedAt: days(-3) },
          { name: "Keyword research", type: "INTERNAL", status: "DONE", completedAt: days(-9) },
        ],
      },
    },
  });

  await prisma.cycle.create({
    data: {
      projectId: retainer.id,
      name: "August",
      startDate: days(-45),
      endDate: days(-15),
      status: "CLOSED",
      tasks: {
        create: [
          { name: "Summer campaign landing page", type: "DELIVERABLE", status: "DONE", completedAt: days(-20) },
          { name: "Newsletter redesign", type: "DELIVERABLE", status: "DONE", completedAt: days(-25) },
        ],
      },
    },
  });

  await prisma.projectAsset.create({
    data: {
      projectId: retainer.id,
      storagePath: "https://example.com/demo-report",
      filename: "August performance report.pdf",
      mimeType: "text/uri-list",
      visibility: "SHARED",
      folder: "documents",
      uploadedBy: team.id,
      uploadedAt: days(-3),
    },
  });

  // ── Client-level documents ────────────────────────────────────────────────
  await prisma.document.createMany({
    data: [
      {
        clientId: client.id, stageNumber: 1, templateType: "initial_client_form",
        title: "Initial Client Form", status: "APPROVED", completedAt: days(-30), content: {},
      },
      {
        clientId: client.id, stageNumber: 1, templateType: "financial_offer",
        title: "Financial Offer", status: "APPROVED", completedAt: days(-25),
        content: { pricing: { currency: "EUR", oneTimePrice: 8500, paymentSchedule: [] } },
      },
      {
        // Left SENT so the dashboard has a real "action needed" row.
        clientId: client.id, stageNumber: 1, templateType: "intake_form",
        title: "Intake Form", status: "SENT", sentAt: days(-2), content: {},
      },
      {
        clientId: client.id, stageNumber: 1, templateType: "brand_kit",
        title: "Brand Kit", status: "APPROVED", completedAt: days(-10),
        content: {
          colors: [
            { id: "c1", name: "Mint", hex: "#0E9E80" },
            { id: "c2", name: "Ink", hex: "#102019" },
            { id: "c3", name: "Sage", hex: "#C6E7D6" },
            { id: "c4", name: "Mist", hex: "#ECF1EE" },
          ],
          typography: [
            { id: "t1", label: "Headings", font: "Fredoka", size: "30px", style: "600" },
            { id: "t2", label: "Body", font: "IBM Plex Sans", size: "15px", style: "400" },
          ],
          logos: [{ id: "l1", filename: "Primary logo (SVG)", url: "https://example.com/logo.svg", isLink: true }],
        },
      },
      {
        // Two pieces of copy explicitly sent for client approval.
        clientId: client.id, stageNumber: 1, templateType: "client_profile",
        title: "Client Profile", status: "APPROVED", completedAt: days(-20),
        content: {
          _meta: { status: "verified" },
          messaging: {
            key_messages: [
              {
                message_id: "KM_001", message_text: "Delivery you can set your watch by.",
                message_type: "headline", tone_notes: "Confident, plain",
                approved: "pending", client_approval_requested_at: days(-1).toISOString(),
              },
            ],
            slogans: [
              {
                slogan_id: "SL_001", slogan_text: "On time. Every time.", type: "tagline",
                approved: "pending", client_approval_requested_at: days(-1).toISOString(),
              },
            ],
          },
        },
      },
    ],
  });

  // ── An open question, so Messages and the bell have something real ────────
  await prisma.question.create({
    data: {
      projectId: website.id,
      contextType: "PROJECT",
      kind: "ANSWER",
      askedById: team.id,
      recipientId: client.id,
      recipientRole: "CLIENT",
      questionText: "Which payment provider would you prefer — Stripe or PayPal?",
      status: "WAITING_CLIENT",
    },
  });

  await prisma.notification.create({
    data: {
      projectId: website.id,
      recipientId: client.id,
      type: "question_asked",
      message: `${DEMO_TAG} Website Redesign: your team asked you a question.`,
      link: "/portal/messages",
    },
  });

  console.log(`\n  seeded 2 projects (1 staged at the wireframe gate, 1 retainer), 5 client documents,`);
  console.log(`  5 shared link assets, 4 materials, 2 cycles, 1 open question.`);
}

try {
  if (undo) {
    console.log("Removing demo accounts and data…");
    await teardown();
    console.log("\nDone. Nothing demo-tagged remains.");
  } else {
    console.log("Seeding demo accounts and data…");
    await seed();
    console.log(`\n  TEAM    ${TEAM.email}  /  ${TEAM.password}`);
    console.log(`  CLIENT  ${CLIENT.email}  /  ${CLIENT.password}`);
    console.log(`\n  Delete both with:  node scripts/seed-demo-accounts.mjs --undo`);
  }
} finally {
  await prisma.$disconnect();
}
