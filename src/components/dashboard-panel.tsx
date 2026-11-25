import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ChevronsDownUp, ChevronsUpDown, type LucideIcon } from "lucide-react";
import { Button } from "./ui/button";

export interface CollapseState { all: boolean; panels: Record<string, boolean> }
export const INITIAL_COLLAPSE: CollapseState = { all:false, panels:{} };
export function panelCollapsed(state:CollapseState,id:string) {return state.panels[id]??state.all;}
export function togglePanel(state:CollapseState,id:string):CollapseState {return {...state,panels:{...state.panels,[id]:!panelCollapsed(state,id)}};}
export function collapseAll(collapsed:boolean):CollapseState {return {all:collapsed,panels:{}};}
const KEY="neptun-dashboard-panels-v1";
const Context=createContext<{state:CollapseState;toggle:(id:string)=>void;all:(value:boolean)=>void}|null>(null);
export function DashboardPanels({children}:{children:ReactNode}) {
  const [state,setState]=useState<CollapseState>(INITIAL_COLLAPSE),[ready,setReady]=useState(false);
  useEffect(()=>{try {const raw=localStorage.getItem(KEY);if(raw){const v=JSON.parse(raw) as CollapseState;if(typeof v.all==="boolean"&&v.panels&&Object.values(v.panels).every(x=>typeof x==="boolean"))setState(v);}}catch{/* Unavailable storage does not block reporting. */}setReady(true);},[]);
  useEffect(()=>{if(ready)try{localStorage.setItem(KEY,JSON.stringify(state));}catch{/* Session state remains usable. */}},[state,ready]);
  return <Context.Provider value={{state,toggle:id=>setState(s=>togglePanel(s,id)),all:value=>setState(collapseAll(value))}}>{children}</Context.Provider>;
}
export function CollapseControls(){const c=useContext(Context);if(!c)return null;return <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={()=>c.all(true)}><ChevronsDownUp aria-hidden="true" />Collapse all</Button><Button variant="outline" size="sm" onClick={()=>c.all(false)}><ChevronsUpDown aria-hidden="true" />Expand all</Button></div>;}
export function DashboardPanel({id,title,icon:Icon,summary,actions,children,className="",compact=false}:{id:string;title:string;icon?:LucideIcon;summary?:ReactNode;actions?:ReactNode;children:ReactNode;className?:string;compact?:boolean}){
  const c=useContext(Context),contentId=useId(),collapsed=c?panelCollapsed(c.state,id):false;
  return <section data-panel={id} className={`dashboard-panel min-w-0 bg-card ${compact?"dashboard-kpi rounded-lg border border-border":"dashboard-surface border-y border-border"} ${className}`}>
    <div className={`flex flex-wrap items-center gap-2 ${compact?"px-3 pt-3":"px-4 pt-4 sm:px-6"}`}>
      <h2 className={`mr-auto min-w-0 flex-1 font-semibold text-primary ${compact?"text-xs":"text-base"}`}>{Icon&&<Icon aria-hidden="true" className="dashboard-heading-icon" />}{title}</h2>
      {actions}
      <Button size="icon" variant="ghost" className="size-7 shrink-0" aria-label={`${collapsed?"Expand":"Minimize"} ${title}`} aria-expanded={!collapsed} aria-controls={contentId} title={`${collapsed?"Expand":"Minimize"} ${title}`} onClick={()=>c?.toggle(id)}>{collapsed?<ChevronDown aria-hidden="true"/>:<ChevronUp aria-hidden="true"/>}</Button>
    </div>
    {collapsed&&summary&&<div className={`break-words text-muted-foreground ${compact?"px-3 pb-3 pt-1 text-sm":"px-4 pb-4 pt-2 text-xs sm:px-6"}`}>{summary}</div>}
    <div id={contentId} hidden={collapsed} className={compact?"p-3 pt-2":"p-4 pt-3 sm:p-6 sm:pt-3"}>{children}</div>
  </section>;
}

export function useSectionCollapsed(id:string){const c=useContext(Context);return c?panelCollapsed(c.state,id):false;}
export function SectionMinimizeButton({id,title,controls}:{id:string;title:string;controls:string}){const c=useContext(Context),collapsed=c?panelCollapsed(c.state,id):false;return <Button size="icon" variant="ghost" className="size-7 shrink-0" aria-label={`${collapsed?"Expand":"Minimize"} ${title}`} aria-expanded={!collapsed} aria-controls={controls} title={`${collapsed?"Expand":"Minimize"} ${title}`} onClick={()=>c?.toggle(id)}>{collapsed?<ChevronDown aria-hidden="true"/>:<ChevronUp aria-hidden="true"/>}</Button>;}
