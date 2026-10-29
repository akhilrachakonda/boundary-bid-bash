import {createContext,useContext} from 'react';
export const RoomEvaluationContext=createContext<string|undefined>(undefined);
export const useEvaluationRoom=()=>useContext(RoomEvaluationContext);