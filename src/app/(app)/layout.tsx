'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { AppSidebar } from '@/components/shared/AppSidebar';
import { MobileBottomNav } from '@/components/shared/MobileBottomNav';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ROUTES } from '@/lib/constants';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!loading && !user) {
      router.replace(ROUTES.LOGIN);
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <LoadingSpinner
        variant="page"
        showLogo={true}
        label="অ্যাকাউন্ট লোড হচ্ছে..."
      />
    );
  }

  if (pathname === '/') {
    return <>{children}</>;
  }

  return (
    <>
      {/* AppSidebar renders: (1) an in-flow spacer div that expands/collapses,
          and (2) the actual fixed-position panel. The spacer handles the gap. */}
      <AppSidebar />

      {/* flex-1 fills remaining space after the sidebar spacer div.
          min-w-0 prevents content from overflowing the flex item. */}
      <main className="flex-1 min-w-0 pt-2 px-4 sm:px-6 pb-20 md:pb-6">
        <div className="mx-auto w-full max-w-7xl">
          {children}
        </div>
      </main>

      <MobileBottomNav />
    </>
  );
}
