import { Logo } from "@/components/shared/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(circle at 15% -10%, rgba(37,99,235,0.07), transparent 45%), radial-gradient(circle at 100% 110%, rgba(34,197,94,0.06), transparent 45%), hsl(var(--background))",
      }}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-6">
        <Logo />
      </div>
      <div className="flex items-start justify-center px-5 pb-20 pt-6">{children}</div>
    </div>
  );
}
