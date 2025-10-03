import { supabase } from "../services/supabase/client";

export type ToggleCustomerPausedResponse = {
  customer_id: number | string;
  paused: boolean;
};

export async function toggleCustomerPaused(customerId: number | string): Promise<ToggleCustomerPausedResponse> {
  const { data, error } = await supabase.functions.invoke<ToggleCustomerPausedResponse>(
    "toggleCustomerPaused",
    {
      body: JSON.stringify({ customer_id: customerId }),
    },
  );

  if (error) {
    throw new Error(error.message ?? "Não foi possível atualizar o status do cliente.");
  }

  if (!data) {
    throw new Error("Resposta vazia ao atualizar o status do cliente.");
  }

  return data;
}
