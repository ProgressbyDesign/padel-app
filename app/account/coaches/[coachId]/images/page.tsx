import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { loadManagedCoachImages } from "@/lib/queries/managedCoach";

export const metadata: Metadata = {
  title: "Coach images",
  description: "Coach gallery images.",
};

type PageProps = {
  params: Promise<{ coachId: string }>;
};

export default async function ManagedCoachImagesPage({ params }: PageProps) {
  const { coachId } = await params;
  const images = await loadManagedCoachImages(coachId);
  if (!images) notFound();

  return (
    <section className="space-y-6 rounded-[24px] border border-primary/10 bg-white p-5 sm:p-7">
      <div>
        <h2 className="text-2xl font-bold text-primary">Images</h2>
        <p className="mt-2 text-sm text-primary/65">
          {images.length === 0
            ? "No gallery images are linked yet."
            : `${images.length} gallery image${images.length === 1 ? "" : "s"} currently linked.`}
        </p>
      </div>

      {images.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => (
            <li
              key={image.id}
              className="overflow-hidden rounded-2xl border border-primary/10 bg-surface"
            >
              <div className="relative aspect-[4/3]">
                <Image
                  src={image.image_url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 33vw"
                  unoptimized
                />
              </div>
              {image.is_primary ? (
                <p className="px-3 py-2 text-xs font-semibold text-primary/70">
                  Primary
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="rounded-2xl border border-dashed border-primary/20 bg-surface/60 p-5 text-sm leading-6 text-primary/70">
        <p className="font-semibold text-primary">Uploads coming next</p>
        <p className="mt-2">
          Member image rows can already be read and managed in the database, but
          secure browser uploads to the <code className="font-mono text-xs">coach-images</code>{" "}
          Storage bucket still need Storage policies. Uploads stay disabled until
          that configuration is in place.
        </p>
      </div>
    </section>
  );
}
