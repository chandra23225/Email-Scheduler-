'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/lib/api';
import { Mail, Zap } from 'lucide-react';

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleGoogleLogin = () => {
    window.location.href = authApi.googleLoginUrl();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500 text-lg font-bold text-white">
            O
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">outbox</h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-slate-400">Email workspace</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-surface-border bg-white p-8 shadow-sm">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Welcome back</h2>
            <p className="text-slate-400 text-sm mt-1">
              Sign in to manage your email campaigns
            </p>
          </div>

          {/* Features */}
          <div className="space-y-3 mb-8">
            {[
              { icon: <Mail className="w-4 h-4" />, text: 'Schedule emails with BullMQ precision' },
              { icon: <Zap className="w-4 h-4" />, text: 'Real-time queue visibility' },
              { icon: <Mail className="w-4 h-4" />, text: 'Rate limiting & Slack alerts' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-slate-500">
                <span className="text-primary-600">{f.icon}</span>
                <span>{f.text}</span>
              </div>
            ))}
          </div>

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-primary-500 px-4 py-3 font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-600 active:scale-[0.98]"
          >
            {/* Google SVG */}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-xs text-slate-500 mt-4">
            By signing in, you agree to our Terms of Service
          </p>
        </div>
      </div>
    </div>
  );
}
