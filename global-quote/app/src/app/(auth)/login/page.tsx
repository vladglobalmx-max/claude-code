import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Global Supplier MTY
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">GLOBAL QUOTE</h1>
        <p className="mt-1 text-sm text-zinc-500">Quotation &amp; Commercial Control System</p>
      </div>
      <LoginForm callbackUrl={callbackUrl ?? "/dashboard"} />
    </div>
  );
}
