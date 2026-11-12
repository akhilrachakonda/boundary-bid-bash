import type { Room } from '@/hooks/use-room';
export interface RepairCapabilities { auction_controls?: number; action_sync?: number; bounded_poll?: number; community?: number }
export function repairsEnabled(room: Room | null, capabilities: RepairCapabilities) {
 return capabilities.auction_controls === 1 && room?.repair_flow === true;
}
export function auctionCommandArgs(room: Room, action: string, request: string, payload: object = {}) {
 return { p_room: room.id, p_action: action, p_lot: room.current_rp, p_version: room.lot_version,
  p_status: room.status, p_revision: room.control_revision ?? 0, p_request: request,
  p_payload: { ...payload, observed_bid_revision: room.bid_revision ?? 0 } };
}
export function validTimers(timer: number, extension: number) {
 return Number.isInteger(timer) && Number.isInteger(extension) && timer >= 1 && timer <= 120 && extension >= 1 && extension <= 120;
}
