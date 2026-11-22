/** Responses from the authenticated Google Apps Script routing bridge. No API keys in the PWA. */
export interface RouteStop { id: string; location: string }
export interface RouteLeg { fromId: string; toId: string; fromLabel: string; toLabel: string; minutes: number | null; km: number | null; error?: string }
export interface RoutePlanResponse { legs: RouteLeg[]; note?: string }
