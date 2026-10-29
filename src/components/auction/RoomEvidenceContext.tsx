import { createContext,useContext } from 'react';
export const RoomEvidenceContext=createContext<string|null|undefined>(undefined);
export const useRoomSnapshot=()=>useContext(RoomEvidenceContext);
