import { GradientText } from "@animate-ui/react/primitives/texts/gradient";

interface ShinyTextProps {
  text: string;
  speed?: number;
  className?: string;
}

export function ShinyText({ text, speed = 2, className }: ShinyTextProps) {
  return (
    <GradientText
      text={text}
      className={className}
      aria-label={text}
      gradient="linear-gradient(110deg, var(--muted-foreground) 0%, var(--muted-foreground) 35%, color-mix(in srgb, var(--muted-foreground) 25%, white) 50%, var(--muted-foreground) 65%, var(--muted-foreground) 100%)"
      transition={{ duration: Math.max(0.1, speed) * 2.5, repeat: Infinity, ease: "linear" }}
    />
  );
}

export default ShinyText;
