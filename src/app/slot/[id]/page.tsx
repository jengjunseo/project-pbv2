import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SlotEditor } from "@/components/SlotEditor";
import { validateSlotId } from "@/lib/validation";

type SlotPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SlotPage({ params }: SlotPageProps) {
  const { id: rawId } = await params;
  const id = validateSlotId(rawId);

  if (!id.ok) {
    notFound();
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-300 bg-white px-3 text-sm font-medium text-stone-700 transition hover:border-stone-500 hover:text-stone-950"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          돌아가기
        </Link>
        <span className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white">
          PB #{id.value}
        </span>
      </div>

      <SlotEditor id={id.value} />
    </main>
  );
}
