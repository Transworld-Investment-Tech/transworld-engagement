import { redirect } from "next/navigation";
import { getCurrentUser, hasRole } from "@/lib/session";
import AppShell from "@/components/AppShell";
import DocumentUploadForm from "@/components/DocumentUploadForm";

export const dynamic = "force-dynamic";

export default async function NewDocumentPage() {
  const user = await getCurrentUser();
  if (!hasRole(user, "manager")) redirect("/documents");
  return (
    <AppShell user={user}>
      <div className="mb-6">
        <div className="eyebrow">Documents</div>
        <h1 className="mt-1 font-serif text-3xl text-ink">New document</h1>
        <p className="mt-1 text-sm text-muted">
          Upload a PDF, choose who signs, and we will prepare it for signing.
        </p>
      </div>
      <DocumentUploadForm currentUser={{ id: user.id, name: user.name, email: user.email }} />
    </AppShell>
  );
}
