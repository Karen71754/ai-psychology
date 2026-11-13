import { AuthView, authViewPaths } from "@neondatabase/auth-ui";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }));
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;

  return (
    <main className="auth-screen">
      <div className="auth-brand">
        <span className="auth-mark">ψ</span>
        <div>
          <strong>AI Psychology</strong>
          <span>Твоё пространство для разговора</span>
        </div>
      </div>
      <AuthView path={path} />
    </main>
  );
}
