import { useState, useCallback } from 'react';
import { APP_VERSION } from '../lib/version';

const FOOD_EMOJIS = ['🥪','🍔','🍕','🌯','🍝','🧃','☕','🫖','🥛','🍜','🥗','🌮','🍱','🧁','🍩','🍎','🥐','🍞','🥨','🧀','🥓','🥚','🧆','🥘','🍲','🫕','🥙','🫔','🍌','🥞','🧇','🍟','🌭','🥯','🌯','🌮','🥗','🧆','🍿','🍳','🍜','🍪','🍵','🍶','🧋'];

function EasterEgg() {
  const [particles, setParticles] = useState([]);
  const [clicks, setClicks] = useState(0);
  // Randomize the burst threshold between 10 and 15, once on mount
  const [burstAt] = useState(() => 10 + Math.floor(Math.random() * 6));

  const spawnParticle = useCallback((emoji, big = false) => {
    const id = Date.now() + Math.random();
    const particle = {
      id,
      emoji,
      x: 10 + Math.random() * 80,
      size: big ? 48 + Math.floor(Math.random() * 24) : 28 + Math.floor(Math.random() * 16),
      dur: big ? 7 + Math.random() * 2 : 2.5 + Math.random() * 1.5,
      sway: (Math.random() - 0.5) * 140,
      delay: 0,
    };
    setParticles(prev => [...prev, particle]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id !== id));
    }, (particle.dur + 0.5) * 1000);
    return particle;
  }, []);

  const handleClick = useCallback(() => {
    const newClicks = clicks + 1;

    if (newClicks >= burstAt) {
      // Big burst — 14 emojis, staggered
      const now = Date.now();
      const burst = Array.from({ length: 14 }, (_, i) => {
        const emoji = FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)];
        const id = now + i;
        const size = 52 + Math.floor(Math.random() * 28);
        const dur = 7 + Math.random() * 2;
        const particle = {
          id,
          emoji,
          x: 5 + Math.random() * 90,
          size,
          dur,
          sway: (Math.random() - 0.5) * 180,
          delay: i * 100,
        };
        return particle;
      });
      setParticles(prev => [...prev, ...burst]);
      burst.forEach(p => {
        setTimeout(() => {
          setParticles(prev => prev.filter(x => x.id !== p.id));
        }, (p.dur + p.delay / 1000 + 0.5) * 1000);
      });
      // Reset counter and pick new random burst threshold
      setClicks(0);
    } else {
      // Single emoji
      const emoji = FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)];
      spawnParticle(emoji, false);
      setClicks(newClicks);
    }
  }, [clicks, burstAt, spawnParticle]);

  return (
    <>
      {/* Floating emojis — rendered at fixed position over entire viewport */}
      {particles.map(p => (
        <span key={p.id} style={{
          position: 'fixed',
          left: `${p.x}%`,
          bottom: '48px',
          fontSize: `${p.size}px`,
          lineHeight: 1,
          pointerEvents: 'none',
          zIndex: 9999,
          animationName: 'bm-easter-float',
          animationDuration: `${p.dur}s`,
          animationDelay: `${p.delay}ms`,
          animationTimingFunction: 'ease-out',
          animationFillMode: 'forwards',
          '--sway': `${p.sway}px`,
          userSelect: 'none',
        }}>
          {p.emoji}
        </span>
      ))}

      {/* Version pill */}
      <button
        className="bm-version-pill"
        onClick={handleClick}
        title="🍽️"
        style={{ cursor: 'pointer' }}
      >
        {APP_VERSION}
      </button>
    </>
  );
}

export function UsageFooter({ myUsage, config, extraBreaks = 0 }) {
  return (
    <footer className="bm-footer">
      Vandaag: <b>{myUsage.short}</b>/{config.shortPerDay + extraBreaks} kort ·{' '}
      <b>{myUsage.lunch}</b>/{config.lunchPerDay} lunch · BRB onbeperkt
      <EasterEgg />
    </footer>
  );
}
