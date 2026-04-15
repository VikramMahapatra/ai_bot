import { createContext, useContext } from "react";

export const FlowContext = createContext<any>(null);

export const useFlow = () => useContext(FlowContext);