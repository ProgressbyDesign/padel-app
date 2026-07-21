import { notFound } from "next/navigation";
import ManagedVenueHeader from "@/components/account/ManagedVenueHeader";
import ManagedVenueNav from "@/components/account/ManagedVenueNav";
import { loadManagedVenueShell } from "@/lib/queries/managedVenueShell";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ venueId: string }>;
};

export default async function ManagedVenueLayout({
  children,
  params,
}: LayoutProps) {
  const { venueId } = await params;
  const shell = await loadManagedVenueShell(venueId);
  if (!shell) notFound();

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 py-8 sm:px-6 sm:py-12 lg:px-[120px]">
      <ManagedVenueHeader
        venueId={shell.id}
        name={shell.name}
        city={shell.city}
        country={shell.country}
        membershipRole={shell.membershipRole}
        isApproved={shell.is_approved}
        dataQualityStatus={shell.data_quality_status}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ManagedVenueNav venueId={shell.id} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
