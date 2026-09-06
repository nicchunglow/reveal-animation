'use client';

import dynamic from 'next/dynamic';

/* the whole reveal is WebGL + canvas APIs, so it only ever runs in the browser */
const MatchupReveal = dynamic(() => import('@/components/matchup-reveal'), {
  ssr: false,
  loading: () => <div className="boot">Loading scene&hellip;</div>,
});

export default function Page() {
  return <MatchupReveal />;
}
