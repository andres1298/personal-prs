// Which screen the app opened on last on this device ('plan', 'exec' or 'coach'), so the loading
// screen, drawn before the server knows the role, shows the skeleton of the right one.
export const SHELL_KEY = 'prs_shell';
export const SHELLS = ['plan', 'exec', 'coach'];

/** Runs in <head> before the first paint: marks <html data-shell> from the device's memory. */
export const SHELL_SCRIPT = `try{var s=localStorage.getItem('${SHELL_KEY}');if(${SHELLS.map((shell) => `s==='${shell}'`).join('||')})document.documentElement.dataset.shell=s}catch(e){}`;

/** Shows `shell`'s skeleton on the next loading screen; with `remember`, also on the next visit. */
export function setShell(shell, remember = false) {
  if (typeof document === 'undefined' || !SHELLS.includes(shell)) return;
  document.documentElement.dataset.shell = shell;
  if (remember) try { localStorage.setItem(SHELL_KEY, shell); } catch {}
}

/** Signing out forgets it: the next person starts from the athlete's skeleton. */
export function forgetShell() {
  if (typeof document === 'undefined') return;
  delete document.documentElement.dataset.shell;
  try { localStorage.removeItem(SHELL_KEY); } catch {}
}
