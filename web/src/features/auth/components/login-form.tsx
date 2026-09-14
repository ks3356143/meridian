import { gsap, useGSAP } from "@/lib/gsap";
import { Loader2, LogIn } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { authApi } from "@/features/auth/api";
import { useAuthStore } from "@/stores/auth-store";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface FormValues {
  username: string;
  password: string;
}

export function LoginForm({ redirectTo = "/" }: { redirectTo?: string }) {
  const containerRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [values, setValues] = useState<FormValues>({ username: "", password: "" });
  const [errors, setErrors] = useState<FormValues>({ username: "", password: "" });
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap.from(".login-reveal", {
        opacity: 0,
        y: 16,
        duration: 0.5,
        ease: "power3.out",
      });

      gsap.from(".login-field", {
        opacity: 0,
        y: 12,
        duration: 0.45,
        stagger: 0.06,
        ease: "power3.out",
        delay: 0.1,
      });
    },
    { scope: containerRef },
  );

  const updateValue = (field: keyof FormValues, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: "" }));
    setServerError("");
  };

  const validate = () => {
    const nextErrors: FormValues = {
      username: values.username.trim() ? "" : "请输入用户名",
      password: values.password ? "" : "请输入密码",
    };
    setErrors(nextErrors);
    return !nextErrors.username && !nextErrors.password;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate() || submitting) return;

    setSubmitting(true);
    try {
      const result = await authApi.login({
        username: values.username.trim(),
        password: values.password,
      });
      setAuth(result.accessToken, result.expiresAt, result.user);
      toast.success("登录成功");
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      ref={containerRef}
      onSubmit={handleSubmit}
      noValidate
      aria-busy={submitting}
      className="flex flex-1 flex-col justify-center gap-7 p-2 sm:p-4"
    >
      <div className="login-reveal">
        <p className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
          ChenMeridian Access
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">登录工作台</h1>
        <div className="bg-primary mt-4 h-0.5 w-10" aria-hidden />
      </div>

      {serverError ? (
        <Alert variant="destructive">
          <AlertTitle>登录失败</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup className="gap-5">
        <Field className="login-field" data-invalid={errors.username ? true : undefined}>
          <FieldLabel htmlFor="username">用户名</FieldLabel>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            spellCheck={false}
            value={values.username}
            aria-invalid={Boolean(errors.username)}
            onChange={(event) => updateValue("username", event.target.value)}
          />
          {errors.username ? <FieldError>{errors.username}</FieldError> : null}
        </Field>

        <Field className="login-field" data-invalid={errors.password ? true : undefined}>
          <FieldLabel htmlFor="password">密码</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={values.password}
            aria-invalid={Boolean(errors.password)}
            onChange={(event) => updateValue("password", event.target.value)}
          />
          {errors.password ? <FieldError>{errors.password}</FieldError> : null}
        </Field>
      </FieldGroup>

      <Button type="submit" size="lg" disabled={submitting} className="btn-sheen mt-1 h-11">
        {submitting ? (
          <Loader2 data-icon="inline-start" className="animate-spin" />
        ) : (
          <LogIn data-icon="inline-start" />
        )}
        {submitting ? "正在登录" : "进入工作台"}
      </Button>

      <div className="border-border/60 text-muted-foreground flex items-center justify-between border-t pt-4 text-xs">
        <span className="font-mono tracking-widest">INITIAL LOGIN</span>
        <span className="font-mono">admin / admin123</span>
      </div>
    </form>
  );
}
