
export function entropyBits(pw: string): number {
  if (!pw) return 0;
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 32;
  return pw.length * Math.log2(pool || 1);
}


export function passwordScore(pw: string): number {
  if (!pw) return 0;
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 32;
  const entropy = pw.length * Math.log2(pool || 1);
  if (entropy < 28) return 0;
  if (entropy < 40) return 1;
  if (entropy < 60) return 2;
  if (entropy < 80) return 3;
  return 4;
}

export const scoreLabel = ["Very weak", "Weak", "Fair", "Strong", "Very strong"] as const;
export const scoreColor = ["#f07070", "#f0b842", "#f0b842", "#4cde8c", "#4cde8c"] as const;


const SECONDS_PER_ATTEMPT: Record<"interactive" | "moderate" | "paranoid", number> = {
  interactive: 0.5,
  moderate: 2,
  paranoid: 5,
};


export function crackTimeLabel(bits: number, preset: "interactive" | "moderate" | "paranoid"): string {
  if (bits < 20) return "Instant";
  const guesses = Math.pow(2, bits - 1);
  const seconds = guesses * SECONDS_PER_ATTEMPT[preset];
  return formatDuration(seconds);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s to crack`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(0)}m to crack`;
  if (seconds < 86_400) return `${(seconds / 3600).toFixed(0)}h to crack`;
  if (seconds < 86_400 * 365) return `${(seconds / 86_400).toFixed(0)}d to crack`;

  const years = seconds / (86_400 * 365);
  if (years < 1_000) return `~${years.toFixed(0)} years to crack`;
  if (years < 1_000_000) return `~${(years / 1_000).toFixed(0)}k years to crack`;
  if (years < 1_000_000_000) return `~${(years / 1_000_000).toFixed(0)}M years to crack`;
  if (years < 1e15) return `~${(years / 1_000_000_000).toFixed(0)}B years to crack`;
  return "Heat death of the universe";
}
