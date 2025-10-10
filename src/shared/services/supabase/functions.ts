import type { FunctionsFetchResult } from "@supabase/supabase-js";
import { supabase } from "./client";
import { ensureDeviceId } from "../../utils/device";

type InvokeOptions<T> = Parameters<typeof supabase.functions.invoke<T>>[1];

type InvokeReturn<T> = FunctionsFetchResult<T>;

export async function invokeFunction<T = unknown>(
  functionName: string,
  options: InvokeOptions<T> = {},
): Promise<InvokeReturn<T>> {
  const deviceId = ensureDeviceId();
  const headers = new Headers(options?.headers ?? {});
  if (deviceId) {
    headers.set("X-Client-Device-Id", deviceId);
  }

  return supabase.functions.invoke<T>(functionName, {
    ...options,
    headers,
  });
}
