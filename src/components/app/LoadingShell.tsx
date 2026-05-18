import { Loader2 } from "lucide-react";

type LoadingShellProps = {
  label: string;
};

export function LoadingShell({ label }: LoadingShellProps) {
  return (
    <main className="loading-shell">
      <Loader2 aria-hidden="true" size={22} />
      <span>{label}</span>
    </main>
  );
}
