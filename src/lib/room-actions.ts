import { supabase } from '@/integrations/supabase/client';
import type { Room } from '@/hooks/use-room';

export function hostActionArgs(room: Room, action: string, sale?: string) {
  return { p_room: room.id, p_action: action, p_version: room.lot_version, p_status: room.status, p_sale: sale ?? null };
}

export function bidArgs(room: Room, amount: number, request: string) {
  return { p_room: room.id, p_amount: amount, p_lot: room.current_rp, p_version: room.lot_version, p_request: request };
}

export async function boundHostAction(room: Room, action: string, sale?: string) {
  const { data, error } = await supabase.rpc('host_control', hostActionArgs(room, action, sale));
  return { data, error };
}