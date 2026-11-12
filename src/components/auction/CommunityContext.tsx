import {createContext,useContext} from 'react';
export const CommunityContext=createContext(false);
export const useCommunityMode=()=>useContext(CommunityContext);
