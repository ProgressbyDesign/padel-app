import { notFound } from "next/navigation";
import ManagedCoachHeader from "@/components/account/ManagedCoachHeader";
import ManagedCoachNav from "@/components/account/ManagedCoachNav";
import { loadManagedCoachShell } from "@/lib/queries/managedCoachShell";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ coachId: string }>;
};

export default async function ManagedCoachLayout({
  children,
  params,
}: LayoutProps) {
  const { coachId } = await params;
  const shell = await loadManagedCoachShell(coachId);
  if (!shell) notFound();

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 py-8 sm:px-6 sm:py-12 lg:px-[120px]">
      <ManagedCoachHeader
        coachId={shell.id}
        name={shell.name}
        membershipRole={shell.membershipRole}
        isApproved={shell.is_approved}
        dataQualityStatus={shell.data_quality_status}
        primaryLocation={shell.primaryLocation}
        coachingRole={shell.role}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ManagedCoachNav coachId={shell.id} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
