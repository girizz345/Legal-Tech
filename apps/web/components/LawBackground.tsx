"use client";

import { useMemo } from "react";

interface Particle { id: number; left: string; size: number; duration: number; delay: number; drift: number; opacity: number; }
interface Ray { left: string; width: number; skew: number; delay: number; duration: number; }

function seedRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

export function LawBackground() {
  const particles = useMemo<Particle[]>(() => {
    const rng = seedRandom(42);
    return Array.from({ length: 28 }, (_, i) => ({
      id: i,
      left: `${rng() * 100}%`,
      size: rng() * 2.5 + 0.8,
      duration: rng() * 18 + 12,
      delay: rng() * 20,
      drift: rng() * 80 - 40,
      opacity: rng() * 0.35 + 0.1,
    }));
  }, []);

  const rays = useMemo<Ray[]>(() => [
    { left: "15%",  width: 90,  skew: -14, delay: 0,   duration: 9  },
    { left: "35%",  width: 140, skew: -4,  delay: 2.5, duration: 12 },
    { left: "55%",  width: 100, skew: 2,   delay: 5,   duration: 8  },
    { left: "75%",  width: 70,  skew: 10,  delay: 1,   duration: 11 },
    { left: "88%",  width: 55,  skew: 16,  delay: 3.5, duration: 7  },
  ], []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {/* Ambient top gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 65%)," +
            "radial-gradient(ellipse 60% 30% at 50% 100%, rgba(9,13,30,0.9) 0%, transparent 80%)",
        }}
      />

      {/* Subtle marble veins */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(12deg, transparent 0px, transparent 120px, rgba(201,168,76,0.8) 121px, transparent 122px)," +
            "repeating-linear-gradient(-8deg, transparent 0px, transparent 200px, rgba(201,168,76,0.5) 201px, transparent 202px)",
        }}
      />

      {/* Courthouse arch suggestion at top */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2"
        style={{
          width: "60%",
          height: "3px",
          background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.12), rgba(201,168,76,0.25), rgba(201,168,76,0.12), transparent)",
          boxShadow: "0 0 40px 4px rgba(201,168,76,0.06)",
        }}
      />

      {/* Light rays from above */}
      {rays.map((ray, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: "-120px",
            left: ray.left,
            width: ray.width,
            height: "90%",
            background: "linear-gradient(180deg, rgba(201,168,76,0.12) 0%, rgba(201,168,76,0.03) 50%, transparent 100%)",
            transform: `skewX(${ray.skew}deg) translateX(-50%)`,
            animationName: "light-ray-pulse",
            animationDuration: `${ray.duration}s`,
            animationDelay: `${ray.delay}s`,
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
          }}
        />
      ))}

      {/* Dust particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            bottom: "-8px",
            left: p.left,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: `rgba(201,168,76,${p.opacity})`,
            boxShadow: `0 0 ${p.size * 2}px rgba(201,168,76,${p.opacity * 0.6})`,
            animationName: "particle-rise",
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
            ["--drift" as string]: `${p.drift}px`,
          }}
        />
      ))}

      {/* Floor horizon glow */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: "1px",
          background: "linear-gradient(90deg, transparent 0%, rgba(201,168,76,0.08) 30%, rgba(201,168,76,0.15) 50%, rgba(201,168,76,0.08) 70%, transparent 100%)",
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 35%, rgba(5,8,18,0.5) 75%, rgba(5,8,18,0.82) 100%)",
        }}
      />
    </div>
  );
}
