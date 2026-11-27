import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { FamilyGate } from './components/FamilyGate';
import './index.css';

(window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};
const origError = console.error;
console.error = (...args: unknown[]) => {
  origError.apply(console, args);
  const msg = args.map(a => String(a)).join(' ');
  if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};
// Capture notification links even while the family passcode gate is closed.
navigator.serviceWorker?.addEventListener('message',event=>{
  const id=event.data?.updateId;
  if(event.data?.type!=='WAYBOOK_PUSH_OPEN'||typeof id!=='string'||!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(id))return;
  const url=new URL(location.href);url.searchParams.set('wbUpdate',id);history.replaceState(history.state,'',url.href);
  window.dispatchEvent(new CustomEvent('waybook:updateLink',{detail:id}));
});
createRoot(document.getElementById('root')!).render(<FamilyGate><App /></FamilyGate>);
