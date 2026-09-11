import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
export class ApiError extends Error {
  status: number;
  title: string;
  detail?: string;

  constructor(status: number, title: string, detail?: string) {
    super(detail || title);
    this.status = status;
    this.title = title;
    this.detail = detail;
  }
}

interface RequestOptions {
  skipErrorToast?: boolean;
}

interface HumaProblem {
  title?: string;
  status?: number;
  detail?: string;
  errors?: Array<{ message?: string }>;
}

function fallbackMessage(status: number) {
  switch (status) {
    case 400:
      return "请求参数不正确";
    case 401:
      return "登录状态已过期";
    case 403:
      return "没有权限执行该操作";
    case 404:
      return "资源不存在";
    case 500:
      return "服务器内部错误";
    case 422:
      return "输入的参数不符合要求，请检查后重试";
    default:
      return `请求失败 (${status})`;
  }
}

export async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
  body?: unknown,
): Promise<T> {
  const headers = new Headers();
  const token = useAuthStore.getState().token;

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    const error = new ApiError(0, "网络错误", "无法连接本地服务");
    if (!options.skipErrorToast) toast.error(error.message);
    throw error;
  }

  if (!response.ok) {
    let problem: HumaProblem = {};
    try {
      problem = (await response.json()) as HumaProblem;
    } catch {
      problem = {};
    }

    const detail =
      (response.status === 422
        ? null
        : problem.errors?.map((error) => error.message || "参数校验失败").join("；")) ||
      problem.detail ||
      problem.title ||
      fallbackMessage(response.status);

    if (response.status === 401 && !options.skipErrorToast) {
      useAuthStore.getState().clear();
    }
    if (!options.skipErrorToast) {
      toast.error(detail);
    }
    throw new ApiError(response.status, problem.title || fallbackMessage(response.status), detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
