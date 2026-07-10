export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-base font-bold text-accent-ink">
            G
          </div>
          <span className="text-lg font-semibold tracking-wide text-ink">GAIOS</span>
        </div>
        {children}
      </div>
    </div>
  );
}
