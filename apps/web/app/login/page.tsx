import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '../../components/auth/login-form';

export const metadata: Metadata = {
  title: 'Client Access | AURELIA TECH',
  description: 'Sign in to your AURELIA TECH account with a one-time email code or Google.',
};

export default function LoginPage() {
  return (
    <div className="py-6 md:py-10">
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-md px-margin py-space-xl">
            <div className="flex items-center justify-center rounded-xl border border-outline-variant/40 bg-surface-container-lowest py-16">
              <span
                aria-hidden="true"
                className="material-symbols-outlined animate-spin text-[28px] text-primary"
              >
                progress_activity
              </span>
            </div>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
