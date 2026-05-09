'use client';
import { Suspense } from 'react';
import { MainView } from '@/components/MainView';

export default function Home() {
  return (
    <Suspense fallback={<div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-400 font-mono text-sm">Loading Visualizer...</div>}>
      <MainView />
    </Suspense>
  );
}
