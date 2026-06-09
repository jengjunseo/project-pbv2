"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { validateSlotId } from "@/lib/validation";

export function NumberForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = validateSlotId(value);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }

    setError("");
    router.push(`/slot/${parsed.value}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
      <div className="min-w-0 flex-1">
        <label htmlFor="slot-number" className="sr-only">
          번호
        </label>
        <input
          id="slot-number"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError("");
          }}
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="0~99"
          className="h-12 w-full rounded-md border border-stone-300 bg-white px-4 text-lg font-semibold outline-none transition placeholder:text-stone-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
        />
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>
      <button
        type="submit"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-stone-950 px-5 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-100"
      >
        열기
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </form>
  );
}
