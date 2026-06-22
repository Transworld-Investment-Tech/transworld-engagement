import { redirect } from "next/navigation";
import { getCurrentUser, hasRole } from "@/lib/session";
import AppShell from "@/components/AppShell";
import GreetingTemplateForm from "@/components/GreetingTemplateForm";

export const dynamic = "force-dynamic";

export default async function NewTemplatePage() {
  const user = await getCurrentUser();
  if (!hasRole(user, "manager")) redirect("/greetings/templates");
  return (
    <AppShell user={user}>
      <div className="mb-6">
        <div className="eyebrow">Greetings</div>
        <h1 className="mt-1 font-serif text-3xl text-ink">New template</h1>
      </div>
      <GreetingTemplateForm />
    </AppShell>
  );
}
