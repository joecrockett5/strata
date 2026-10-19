import { useCurrentUser } from "@/features/auth/auth";

/** Temporary landing page until the role-specific screens land (M3/M4). */
export function WelcomePage({ title }: { title: string }) {
  const { data: user } = useCurrentUser();
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-slate-600">Signed in as {user?.email}.</p>
    </main>
  );
}
