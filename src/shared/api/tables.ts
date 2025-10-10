import { invokeFunction } from "../services/supabase/functions";
import { formatRateLimitError, RateLimitError, toRateLimitError } from "../utils/errors";

export type ToggleCustomerPausedResponse = {
  customer_id: number | string;
  paused: boolean;
};

export async function toggleCustomerPaused(customerId: number | string): Promise<ToggleCustomerPausedResponse> {
  const { data, error } = await invokeFunction<ToggleCustomerPausedResponse>(
    "toggleCustomerPaused",
    {
      body: JSON.stringify({ customer_id: customerId }),
    },
  );

  if (error) {
    const rateLimitError = await toRateLimitError(error);
    if (rateLimitError) {
      throw new RateLimitError(formatRateLimitError(rateLimitError, "Muitas requisições ao atualizar o status."), rateLimitError.retryAfterSeconds);
    }
    throw new Error(error.message ?? "Não foi possível atualizar o status do cliente.");
  }

  if (!data) {
    throw new Error("Resposta vazia ao atualizar o status do cliente.");
  }

  return data;
}
