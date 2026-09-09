import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Client Data moved to the client level. This project-scoped route now just
// forwards to the parent client's shared Client Data page.
export default async function ProjectDataRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { clientId: true },
  });
  if (!project) notFound();
  redirect(`/clients/${project.clientId}/data${tab ? `?tab=${tab}` : ""}`);
}
