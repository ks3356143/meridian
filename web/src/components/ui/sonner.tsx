import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "color-mix(in oklch, var(--success) 14%, var(--popover))",
          "--success-border": "color-mix(in oklch, var(--success) 38%, var(--border))",
          "--success-text": "var(--success)",
          "--info-bg": "color-mix(in oklch, var(--info) 14%, var(--popover))",
          "--info-border": "color-mix(in oklch, var(--info) 38%, var(--border))",
          "--info-text": "var(--info)",
          "--warning-bg": "color-mix(in oklch, var(--warning) 18%, var(--popover))",
          "--warning-border": "color-mix(in oklch, var(--warning) 45%, var(--border))",
          "--warning-text": "color-mix(in oklch, var(--warning) 82%, var(--popover-foreground))",
          "--error-bg": "color-mix(in oklch, var(--destructive) 14%, var(--popover))",
          "--error-border": "color-mix(in oklch, var(--destructive) 40%, var(--border))",
          "--error-text": "var(--destructive)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
