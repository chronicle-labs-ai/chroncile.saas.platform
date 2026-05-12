/**
 * No-flash theme script.
 *
 * Consumers embed this as an inline <script> in the <head> before any
 * paint, so the correct `data-theme` is set before first render.
 *
 * Usage (Next.js app root layout):
 *
 *   import { themeScript } from "ui";
 *   <Script
 *     id="chron-theme"
 *     dangerouslySetInnerHTML={{ __html: themeScript }}
 *     strategy="beforeInteractive"
 *   />
 */
export const THEME_STORAGE_KEY = "chron-theme";

export const themeScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var d=document.documentElement;if(t==='light'){d.setAttribute('data-theme','light');}else{d.setAttribute('data-theme','dark');}}catch(e){}})();`;
