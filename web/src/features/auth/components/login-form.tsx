import { useSubtleReveal } from "@/hooks/use-subtle-reveal";
import { EntranceFade } from "@/components/shared/entrance-fade";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { authApi } from "@/features/auth/api";
import { useAuthStore } from "@/stores/auth-store";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CrossfadeIcon } from "@/components/shared/crossfade-icon";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import styles from "./login-form.module.css";

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
  const [showPassword, setShowPassword] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useSubtleReveal(containerRef, ".login-reveal");
  useSubtleReveal(containerRef, ".login-field");

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
    if (nextErrors.username) {
      usernameRef.current?.focus();
    } else if (nextErrors.password) {
      passwordRef.current?.focus();
    }
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
      className="flex flex-1 flex-col justify-center gap-7 p-6 sm:p-8"
    >
      <div className="login-reveal">
        <p className="text-foreground/60 font-mono text-xs tracking-[0.18em] uppercase">
          ChenMeridian Access
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">登录工作台</h1>
        <p className="text-text-secondary mt-2 text-sm">使用本地管理员账号进入测评工作台</p>
        <div className="bg-primary mt-4 h-0.5 w-10" aria-hidden />
      </div>

      {serverError ? (
        <EntranceFade asChild initialOpacity={0.7}>
          <Alert variant="destructive">
            <AlertTitle>登录失败</AlertTitle>
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        </EntranceFade>
      ) : null}

      <FieldGroup className="gap-5">
        <Field className="login-field" data-invalid={errors.username ? true : undefined}>
          <FieldLabel htmlFor="username">用户名</FieldLabel>
          <Input
            ref={usernameRef}
            id="username"
            name="username"
            autoComplete="username"
            spellCheck={false}
            className={styles.touchInput}
            value={values.username}
            aria-invalid={Boolean(errors.username)}
            onChange={(event) => updateValue("username", event.target.value)}
          />
          <FieldError>{errors.username}</FieldError>
        </Field>

        <Field className="login-field" data-invalid={errors.password ? true : undefined}>
          <FieldLabel htmlFor="password">密码</FieldLabel>
          <div className={styles.passwordField}>
            <Input
              ref={passwordRef}
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className={`${styles.touchInput} ${styles.passwordInput}`}
              value={values.password}
              aria-invalid={Boolean(errors.password)}
              onChange={(event) => updateValue("password", event.target.value)}
            />
            <span className={styles.passwordToggle}>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disableRipple
                className={styles.passwordButton}
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                <CrossfadeIcon primary={Eye} secondary={EyeOff} showSecondary={showPassword} />
              </Button>
            </span>
          </div>
          <FieldError>{errors.password}</FieldError>
        </Field>
      </FieldGroup>

      <Button
        type="submit"
        size="lg"
        disabled={submitting}
        className={`btn-sheen mt-1 ${styles.touchButton}`}
      >
        {submitting ? (
          <Loader2 data-icon="inline-start" className="animate-spin" />
        ) : (
          <LogIn data-icon="inline-start" />
        )}
        {submitting ? "正在登录" : "进入工作台"}
      </Button>

      <div className="border-border/60 flex items-center justify-between border-t pt-4 text-xs">
        <span className="text-foreground/55 font-mono tracking-widest">INITIAL LOGIN</span>
        <span className="border-border/70 bg-muted/50 text-foreground/75 rounded-sm border px-2 py-0.5 font-mono text-xs">
          admin / admin123
        </span>
      </div>
    </form>
  );
}
