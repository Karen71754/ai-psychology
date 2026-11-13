import { AccountView, accountViewPaths } from "@neondatabase/auth-ui";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(accountViewPaths).map((path) => ({ path }));
}

export default async function AccountPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  return (
    <main className="auth-screen">
      <div className="auth-brand">
        <span className="auth-mark">ψ</span>
        <div><strong>AI Psychology</strong><span>Настройки аккаунта</span></div>
      </div>
      <AccountView path={path} />
    </main>
  );
}
