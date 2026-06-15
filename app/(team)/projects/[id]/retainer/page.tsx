import { redirect } from "next/navigation";

// Retainer cycles now live on the canonical project page, which renders the
// cycle-based view for ONGOING projects. Redirect any old links here.
export default async function RetainerRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/projects/${id}`);
}
