import { supabase } from "./supabase";

// Generic API wrapper with error handling
export async function apiFetch<T>(
  table: string,
  options?: {
    select?: string;
    eq?: Record<string, string | number | boolean>;
    order?: { column: string; ascending?: boolean };
    limit?: number;
    single?: boolean;
  }
): Promise<T[] | T | null> {
  let query = supabase.from(table).select(options?.select ?? "*");

  if (options?.eq) {
    Object.entries(options.eq).forEach(([col, val]) => {
      query = query.eq(col, val);
    });
  }

  if (options?.order) {
    query = query.order(options.order.column, {
      ascending: options.order.ascending ?? true,
    });
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.single) {
    const { data, error } = await query.single();
    if (error) throw error;
    return data as T;
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as T[];
}

export async function apiInsert<T extends Record<string, any>>(
  table: string,
  payload: Record<string, any>
): Promise<T> {
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return data as T;
}

export async function apiUpdate<T extends Record<string, any>>(
  table: string,
  id: string,
  payload: Record<string, any>
): Promise<T> {
  const { data, error } = await supabase
    .from(table)
    .update(payload as any)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as T;
}

export async function apiDelete(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}
