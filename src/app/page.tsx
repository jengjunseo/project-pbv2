import { NumberForm } from "@/components/NumberForm";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-5 py-10">
      <section className="rounded-lg border border-stone-200 bg-white p-6 shadow-soft sm:p-8">
        <div className="mb-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
            Temporary pocket
          </p>
          <h1 className="text-5xl font-bold tracking-normal text-stone-950 sm:text-6xl">
            PB
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg">
            0~99 번호로 10분 동안 텍스트와 파일을 전달하세요.
          </p>
        </div>

        <NumberForm />

        <p className="mt-7 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          PB는 임시 전달함입니다. 중요한 개인정보나 민감한 파일은 올리지 마세요.
        </p>
      </section>
    </main>
  );
}
