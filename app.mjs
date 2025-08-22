// app.mjs — hosted module for FauxReality
// 1) Load React & ReactDOM from a CDN
import React from "https://esm.sh/react@18";
import ReactDOM from "https://esm.sh/react-dom@18/client";


// 2) (Optional) Ensure Bootstrap CSS is present (for styling)
function ensureBootstrap(){
if(!document.querySelector('link[data-bootstrap]')){
const l=document.createElement('link');
l.rel='stylesheet';
l.href='https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';
l.setAttribute('data-bootstrap','1');
document.head.appendChild(l);
}
}


/* 3) PASTE YOUR FULL CANVAS APP CODE BELOW — EXACTLY AS-IS
- Keep `export default function App(){...}` intact
- Do not remove helpers/components — paste everything
- (This is the entire file content from: 3-page App V8 • Service Day Required + Minor Ux Polish)
*/


// === BEGIN YOUR APP CODE ===
// import React, { useEffect, useMemo, useState } from "react";

// v8.1 — Patch
// • FIX: Define nextInvoiceNumber() to persist and increment invoice numbers in localStorage.
// • TESTS: Added lightweight self-tests (console-only) to verify invoice sequencing logic without touching real data.
// • Everything else from v8 unchanged.

// ---------- Helpers ----------
const ls = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
};

const initialServices = [];
const statesUS = ["AL","AK","AZ","AR","CA","CO","CT","DC","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
function classNames(...arr){ return arr.filter(Boolean).join(" "); }
function currency(n){ const num = Number(n || 0); return num.toLocaleString(undefined,{style:"currency",currency:"USD"}); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function genId(prefix='id'){ return `${prefix}_${Math.random().toString(36).slice(2,9)}`; }
function addDays(dateISO, n){ const d = new Date(dateISO||todayISO()); d.setDate(d.getDate() + (n||0)); return d.toISOString().slice(0,10); }
function weekdayAndDate(iso){ if(!iso) return ''; const d=new Date(iso+'T00:00:00'); const wd=d.toLocaleDateString(undefined,{weekday:'long'}); return `${wd}, ${iso}`; }

// --- Invoice Sequence ---
function nextInvoiceNumberWithKey(storageKey='invoice_seq'){
  const current = Number(ls.get(storageKey, 1000)) || 1000; // default starting seq
  const next = current + 1;
  ls.set(storageKey, next);
  return next;
}
function nextInvoiceNumber(){
  // Public API used by the app (persists to 'invoice_seq')
  return nextInvoiceNumberWithKey('invoice_seq');
}

// Print-to-PDF helper (browser Save-as-PDF)
function openPdfFromElement(el, title){ if(!el) return; const win = window.open('', '_blank', 'noopener,noreferrer'); if(!win) return; const styles = `
  <style>*{box-sizing:border-box}body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica Neue,Arial;color:#111827;margin:0}.wrap{max-width:800px;margin:24px auto;padding:0 16px}.brand{display:flex;flex-direction:column;gap:8px;align-items:center;margin-bottom:16px;text-align:center}.brand img{width:72px;height:72px;object-fit:contain;border-radius:12px;border:1px solid #e5e7eb}.brand .name{font-size:20px;font-weight:700}.brand .meta{color:#4b5563;font-size:12px;line-height:1.3}h1,h2{font-size:22px;margin:8px 0 12px}table{width:100%;border-collapse:collapse}th,td{border-top:1px solid #e5e7eb;padding:8px;text-align:left;font-size:12px}thead th{background:#f9fafb}.totals{margin-top:12px;padding:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px}.paylinks{margin:12px 0;padding:10px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:12px}.chip{display:inline-block;margin:4px 6px 0 0;padding:6px 10px;border:1px solid #d1d5db;border-radius:9999px;font-size:12px;text-decoration:none;color:#1d4ed8}.muted{color:#6b7280;font-size:12px}.section{margin:16px 0}</style>`; const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title||'document'}</title>${styles}</head><body><div class="wrap">${el.outerHTML}</div><script>window.onload=()=>{setTimeout(()=>{window.print();},350)};</script></body></html>`; win.document.open(); win.document.write(html); win.document.close(); }

// ICS helpers
function formatDateICS(iso){ return (iso||todayISO()).replace(/-/g,''); }
function nowStamp(){ const d = new Date(); const pad = n=> String(n).padStart(2,'0'); return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`; }
function escapeICS(text=''){ return String(text).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;'); }
function icsForPlan(plan, customer, biz){
  const freqMap = { weekly: 'WEEKLY', monthly: 'MONTHLY', customDays: 'DAILY' };
  const FREQ = freqMap[plan.frequency] || 'WEEKLY';
  const INTERVAL = Math.max(1, Number(plan.interval||1));
  const DTSTART = formatDateICS(plan.startDate || plan.nextDate || todayISO()); // all-day
  const UNTIL = plan.endDate ? `;UNTIL=${formatDateICS(plan.endDate)}T000000Z` : '';
  const rrule = `RRULE:FREQ=${FREQ};INTERVAL=${INTERVAL}${UNTIL}`;
  const uid = `${plan.id}-${Math.random().toString(36).slice(2,10)}@simple3page.app`;
  const summary = `${plan.name || 'Recurring Service'} — ${customer ? `${customer.firstName||''} ${customer.lastName||''}`.trim() : ''}`.trim();
  const descParts = [];
  if (biz?.name) descParts.push(biz.name);
  if (plan.services?.length) descParts.push(`Services: ${plan.services.join(', ')}`);
  if (plan.items?.length) descParts.push(`Items: ${plan.items.map(i=>i.desc).filter(Boolean).join(', ')}`);
  const description = descParts.join('\n');
  return [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Simple 3-Page App//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowStamp()}`,
    `DTSTART;VALUE=DATE:${DTSTART}`,
    rrule,
    `SUMMARY:${escapeICS(summary)}`,
    description ? `DESCRIPTION:${escapeICS(description)}` : null,
    'END:VEVENT','END:VCALENDAR'
  ].filter(Boolean).join('\r\n');
}

// Date math for plans
function nextOccurrence(dateISO, plan){
  const d = new Date(dateISO||todayISO());
  const interval = Math.max(1, Number(plan.interval||1));
  if(plan.frequency==='weekly'){ d.setDate(d.getDate() + 7*interval); }
  else if(plan.frequency==='monthly'){ d.setMonth(d.getMonth() + interval); }
  else { d.setDate(d.getDate() + interval); } // customDays → daily interval
  return d.toISOString().slice(0,10);
}

// ---------- App ----------
export default function App(){
  const [page, setPage] = useState(1); // 1=Reg, 2=Invoice, 3=Receipt

  // Core persisted data
  const [services, setServices] = useState(()=> ls.get('services', initialServices));
  useEffect(()=>ls.set('services', services), [services]);

  const [paymentLinks, setPaymentLinks] = useState(()=> ls.get('payment_links', []));
  useEffect(()=>ls.set('payment_links', paymentLinks), [paymentLinks]);

  const [biz, setBiz] = useState(()=> ls.get('business_profile', { name:'', email:'', phone:'', address:'', logoUrl:'' }));
  useEffect(()=>ls.set('business_profile', biz), [biz]);

  const [customers, setCustomers] = useState(()=> ls.get('customers', []));
  useEffect(()=>ls.set('customers', customers), [customers]);

  const [plans, setPlans] = useState(()=> ls.get('plans', []));
  useEffect(()=>ls.set('plans', plans), [plans]);

  // Save-on-Continue policy (Option B + auto-update)
  const [savePolicy, setSavePolicy] = useState(()=> ls.get('auto_save_pref', 'ask')); // 'ask' | 'always' | 'never'
  useEffect(()=>ls.set('auto_save_pref', savePolicy), [savePolicy]);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  // Tips modal (first run)
  const [showTips, setShowTips] = useState(()=> !ls.get('hide_tips', false));
  const [dontShowTips, setDontShowTips] = useState(false);

  // Settings modal & tabs
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('services'); // services | methods | branding | customers | plans | data

  // Services tab helpers
  const [newService, setNewService] = useState('');
  const [selectedForDelete, setSelectedForDelete] = useState([]);

  // Payment Methods tab helpers
  const [pmLabel, setPmLabel] = useState('');
  const [pmUrl, setPmUrl] = useState('');

  // Customers tab form
  const emptyCustomer = { id:'', firstName:'', lastName:'', phone:'', email:'', preferred:[], billing:{address:'',city:'',state:'VA',zip:''}, service:{address:'',city:'',state:'VA',zip:''}, defaultServices:[], notes:'' };
  const [custForm, setCustForm] = useState(emptyCustomer);

  // Plans tab form
  const emptyPlan = { id:'', customerId:'', name:'', frequency:'weekly', interval:1, startDate: todayISO(), nextDate: todayISO(), endDate:'', services:[], items:[], dueRule:{daysAfter:7}, active:true };

  // Registration & selection
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [useBillingAddress, setUseBillingAddress] = useState(false); // toggle which address to pull

  const [reg, setReg] = useState({ firstName:'', lastName:'', phone:'', email:'', address:'', city:'', state:'VA', zip:'', selectedServices:[], serviceDate:'', preferred:[] });
  const regValid = useMemo(()=>{
    const req=["firstName","lastName","phone","email","address","city","state","zip","serviceDate"]; // serviceDate now required
    const filled = req.every(k=> String(reg[k]||'').trim().length>0);
    return filled && reg.selectedServices.length>0;
  }, [reg]);

  // Invoice & payment
  const [invoice, setInvoice] = useState(()=>({ invoiceNumber: nextInvoiceNumber(), invoiceDate: todayISO(), dueDate: todayISO(), items:[{desc:'',qty:1,price:0}], notes:'', autoFromReg:false }));
  const subTotal = useMemo(()=> invoice.items.reduce((s,it)=> s + (Number(it.qty)||0)*(Number(it.price)||0), 0), [invoice.items]);
  const grandTotal = subTotal;
  const [payment, setPayment] = useState({ method:'Cash', amount:0, date: todayISO(), reference:'' });
  useEffect(()=>{ setPayment(p=>({ ...p, amount: Number(grandTotal.toFixed(2)) })); }, [grandTotal]);

  // ---------- Self-tests (console only) ----------
  useEffect(()=>{
    try { runSelfTests(); } catch {}
  }, []);

  // ---------- Utility: customers ----------
  function findExistingCustomer(){
    const norm = s=> String(s||'').trim().toLowerCase();
    const byEmail = customers.find(c=> norm(c.email) && norm(c.email)===norm(reg.email));
    if(byEmail) return byEmail;
    const digits = s=> String(s||'').replace(/\D+/g,'');
    const byPhone = customers.find(c=> digits(c.phone) && digits(c.phone)===digits(reg.phone));
    return byPhone || null;
  }

  function saveCustomerFromReg(){
    const id = genId('cst');
    const newC = { id, firstName:reg.firstName, lastName:reg.lastName, phone:reg.phone, email:reg.email, preferred:[...reg.preferred], billing:{ address:reg.address, city:reg.city, state:reg.state, zip:reg.zip }, service:{ address:reg.address, city:reg.city, state:reg.state, zip:reg.zip }, defaultServices:[...reg.selectedServices], notes:'' };
    setCustomers(prev=>[...prev,newC]);
    setSelectedCustomerId(id);
    return newC;
  }
  function updateLoadedCustomer(){
    if(!selectedCustomerId) return;
    setCustomers(prev=> prev.map(c=> c.id===selectedCustomerId ? {
      ...c,
      firstName: reg.firstName, lastName: reg.lastName, phone: reg.phone, email: reg.email, preferred:[...reg.preferred],
      billing: { address:reg.address, city:reg.city, state:reg.state, zip:reg.zip },
      service: { address:reg.address, city:reg.city, state:reg.state, zip:reg.zip },
      defaultServices: [...reg.selectedServices]
    } : c));
  }

  // Registration → Invoice flow with save prompt + auto-update
  function proceedToInvoice(){
    if(selectedCustomerId) updateLoadedCustomer();
    setInvoice(inv=>{
      const onlyBlank = inv.items.length===1 && !inv.items[0].desc && Number(inv.items[0].qty)===1 && Number(inv.items[0].price)===0;
      if(!inv.autoFromReg || onlyBlank){
        const items = (reg.selectedServices.length? reg.selectedServices : ['']).map(s=>({desc:s||'', qty:1, price:0}));
        return { ...inv, items, autoFromReg:true };
      }
      return inv;
    });
    setPage(2);
  }

  function goToInvoice(){
    if(!regValid) return; // enforce required date + fields
    const exists = findExistingCustomer();
    if(exists){
      if(selectedCustomerId){ updateLoadedCustomer(); }
      else {
        setCustomers(prev=> prev.map(c=> c.id===exists.id ? {
          ...c,
          firstName: reg.firstName, lastName: reg.lastName, phone: reg.phone, email: reg.email, preferred:[...reg.preferred],
          billing: { address:reg.address, city:reg.city, state:reg.state, zip:reg.zip },
          service: { address:reg.address, city:reg.city, state:reg.state, zip:reg.zip },
          defaultServices: [...reg.selectedServices]
        } : c));
        setSelectedCustomerId(exists.id);
      }
      proceedToInvoice();
      return;
    }
    const policy = ls.get('auto_save_pref', 'ask');
    if(policy==='always'){ saveCustomerFromReg(); proceedToInvoice(); }
    else if(policy==='never'){ proceedToInvoice(); }
    else { setShowSavePrompt(true); }
  }

  function handleSavePrompt(action){
    if(action==='save') saveCustomerFromReg();
    if(dontAskAgain){ ls.set('auto_save_pref', action==='save' ? 'always' : 'never'); }
    setShowSavePrompt(false);
    proceedToInvoice();
  }

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <header className="bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Simple 3-Page App</h1>
          <div className="flex items-center gap-2">
            <button onClick={()=>{ setShowSettings(true); setSettingsTab('services'); }} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300"><span>Settings</span><GearIcon/></button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4">
        <nav className="mb-4 flex gap-2 text-sm flex-wrap">
          <StepPill label="1. Registration" active={page===1} onClick={()=>setPage(1)} />
          <StepPill label="2. Invoice" active={page===2} onClick={()=>setPage(2)} />
          <StepPill label="3. Receipt" active={page===3} onClick={()=>setPage(3)} />
        </nav>

        {page===1 && (
          <section className="bg-white rounded-2xl shadow p-4 md:p-6">
            <h2 className="text-lg font-semibold mb-4">Customer Registration</h2>

            {/* Existing customer picker */}
            <div className="mb-4 p-3 border rounded-xl bg-gray-50">
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-sm font-medium">Choose existing customer</label>
                <select className="border rounded-xl px-3 py-2" value={selectedCustomerId} onChange={e=>setSelectedCustomerId(e.target.value)}>
                  <option value="">— Select —</option>
                  {customers.map(c=> <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                </select>
                {selectedCustomerId && (
                  <label className="ml-2 text-sm inline-flex items-center gap-2">
                    <input type="checkbox" checked={useBillingAddress} onChange={e=>setUseBillingAddress(e.target.checked)} />
                    Use billing address
                  </label>
                )}
                <button onClick={saveCustomerFromReg} className="ml-auto rounded-xl px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 text-sm">Save current as customer</button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Input label="First Name" value={reg.firstName} onChange={v=>setReg({...reg, firstName:v})} required />
              <Input label="Last Name" value={reg.lastName} onChange={v=>setReg({...reg, lastName:v})} required />
              <Input label="Phone" value={reg.phone} onChange={v=>setReg({...reg, phone:v})} required type="tel" placeholder="(555) 555-5555" />

              {/* Preferred Contact Method */}
              <div>
                <label className="block text-sm font-medium mb-1">Preferred Contact Method (check all that apply)</label>
                <div className="flex flex-wrap gap-4 text-sm">
                  {['Call','Text','Email'].map(opt => (
                    <label key={opt} className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={reg.preferred.includes(opt)} onChange={e=>{
                        const checked = e.target.checked; const arr = new Set(reg.preferred);
                        if(checked) arr.add(opt); else arr.delete(opt);
                        setReg({...reg, preferred: Array.from(arr)});
                      }} /> {opt}
                    </label>
                  ))}
                </div>
              </div>

              <Input label="Email" value={reg.email} onChange={v=>setReg({...reg, email:v})} required type="email" placeholder="name@example.com" />

              <div className="md:col-span-2 grid md:grid-cols-2 gap-4">
                <Input label="Address" value={reg.address} onChange={v=>setReg({...reg, address:v})} required />
                <Input label="City" value={reg.city} onChange={v=>setReg({...reg, city:v})} required />
                <div>
                  <label className="block text-sm font-medium mb-1">State<span className="text-red-500">*</span></label>
                  <select className="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring" value={reg.state} onChange={e=>setReg({...reg, state:e.target.value})}>{statesUS.map(s=> <option key={s} value={s}>{s}</option>)}</select>
                </div>
                <Input label="ZIP" value={reg.zip} onChange={v=>setReg({...reg, zip:v})} required pattern="\\d{5}" placeholder="12345" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Services (multi-select)<span className="text-red-500">*</span></label>
                <MultiSelect options={services} selected={reg.selectedServices} onToggle={(opt)=> setReg(r=> ({...r, selectedServices: r.selectedServices.includes(opt) ? r.selectedServices.filter(s=>s!==opt) : [...r.selectedServices, opt]}))} placeholder="Select services" />
                <p className="text-xs text-gray-500 mt-1">Tap to select multiple. Manage services in Settings.</p>
              </div>

              {/* Service Start Date — REQUIRED */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Service Start Date<span className="text-red-500">*</span></label>
                <input type="date" required className="border rounded-xl px-3 py-2" value={reg.serviceDate} onChange={e=>setReg({...reg, serviceDate:e.target.value})} />
                <p className="text-xs text-gray-500 mt-1">Choose the day service begins (appears as <b>Service Day</b> on the invoice and receipt).</p>
              </div>
            </div>

            <div className="flex justify-end mt-6 gap-2">
              <button disabled={!regValid} onClick={goToInvoice} className={classNames("rounded-xl px-4 py-2 text-white transition", regValid?"bg-blue-600 hover:bg-blue-700":"bg-gray-300 cursor-not-allowed")}>Continue</button>
            </div>
          </section>
        )}

        {page===2 && (
          <section className="bg-white rounded-2xl shadow p-4 md:p-6">
            <div id="invoice-print">
              <BrandHeader biz={biz} />
              <h2 className="text-lg font-semibold mb-4 text-center">Invoice</h2>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <ReadOnly label="Customer" value={`${reg.firstName} ${reg.lastName}`} />
                <ReadOnly label="Phone" value={reg.phone} />
                <ReadOnly label="Email" value={reg.email} />
                <ReadOnly label="Address" value={`${reg.address}, ${reg.city}, ${reg.state} ${reg.zip}`} />
                <ReadOnly label="Service Day" value={weekdayAndDate(reg.serviceDate)} />
                <ReadOnly label="Services" value={reg.selectedServices.join(", ") || "—"} className="md:col-span-1" />
              </div>

              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <Input label="Invoice #" value={invoice.invoiceNumber} onChange={v=>setInvoice({...invoice, invoiceNumber:v})} />
                <Input label="Date" type="date" value={invoice.invoiceDate} onChange={v=>setInvoice({...invoice, invoiceDate:v})} />
                <Input label="Due Date" type="date" value={invoice.dueDate} onChange={v=>setInvoice({...invoice, dueDate:v})} />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left bg-gray-50">
                      <th className="p-2">#</th>
                      <th className="p-2">Description</th>
                      <th className="p-2">Qty</th>
                      <th className="p-2">Unit Price</th>
                      <th className="p-2">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((it, idx)=>{
                      const lineTotal = (Number(it.qty)||0) * (Number(it.price)||0);
                      return (
                        <tr key={idx} className="border-t">
                          <td className="p-2 align-top">{idx+1}</td>
                          <td className="p-2 align-top"><input className="w-full border rounded-lg px-2 py-1" value={it.desc} onChange={e=>{ const items=[...invoice.items]; items[idx]={...items[idx], desc:e.target.value}; setInvoice({...invoice, items}); }} placeholder="Service or product description"/></td>
                          <td className="p-2 align-top"><input type="number" min={0} className="w-24 border rounded-lg px-2 py-1" value={it.qty} onChange={e=>{ const items=[...invoice.items]; items[idx]={...items[idx], qty:e.target.value}; setInvoice({...invoice, items}); }} /></td>
                          <td className="p-2 align-top"><input type="number" min={0} step="0.01" className="w-28 border rounded-lg px-2 py-1" value={it.price} onChange={e=>{ const items=[...invoice.items]; items[idx]={...items[idx], price:e.target.value}; setInvoice({...invoice, items}); }} /></td>
                          <td className="p-2 align-top whitespace-nowrap">{currency(lineTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2 mt-2">
                <button className="px-3 py-1 rounded-lg bg-gray-200 hover:bg-gray-300" onClick={()=>{ const items=[...invoice.items]; items.push({desc:"",qty:1,price:0}); setInvoice({...invoice, items}); }}>Add Row</button>
                <button className="px-3 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200" onClick={()=>{ const items=[...invoice.items]; items.pop(); if(items.length===0) items.push({desc:"",qty:1,price:0}); setInvoice({...invoice, items}); }}>Remove Last</button>
              </div>

              {/* Payment Links block */}
              {paymentLinks?.length>0 && (
                <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <div className="text-sm font-semibold mb-2 text-blue-900">Pay Online</div>
                  <div className="flex flex-wrap gap-3">
                    {paymentLinks.map((l, i)=> (
                      <a key={i} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border hover:bg-blue-100 text-blue-700" href={l.url} target="_blank" rel="noopener noreferrer">
                        <LinkIcon/> <span className="font-medium">{l.label}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 grid md:grid-cols-3 gap-4 items-start">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea className="w-full border rounded-xl px-3 py-2 min-h-[84px]" value={invoice.notes} onChange={e=>setInvoice({...invoice, notes:e.target.value})} placeholder="Optional notes for the customer" />
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex justify-between text-sm"><span>Subtotal</span><span>{currency(subTotal)}</span></div>
                  <div className="flex justify-between text-base font-semibold border-t mt-2 pt-2"><span>Grand Total</span><span>{currency(subTotal)}</span></div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-end mt-6">
              <button onClick={()=>openPdfFromElement(document.getElementById('invoice-print'), `Invoice-${invoice.invoiceNumber}`)} className="rounded-xl px-4 py-2 bg-gray-900 text-white hover:bg-black">Download PDF</button>
              <button onClick={()=>setPage(1)} className="rounded-xl px-4 py-2 bg-gray-200 hover:bg-gray-300">Back</button>
              <button onClick={()=>setPage(3)} className="rounded-xl px-4 py-2 bg-green-600 text-white hover:bg-green-700">Continue to Receipt</button>
            </div>

            <div className="mt-8 p-4 bg-yellow-50 rounded-xl text-sm">
              <p className="font-medium mb-2">Mark Payment (for Receipt)</p>
              <div className="grid md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm mb-1">Method</label>
                  <select className="w-full border rounded-xl px-3 py-2" value={payment.method} onChange={e=>setPayment({...payment, method:e.target.value})}>
                    {['Cash','Cashapp','Paypal','Venmo'].map(m=> <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div><Input label="Amount" type="number" step="0.01" value={payment.amount} onChange={v=>setPayment({...payment, amount:Number(v)||0})} /></div>
                <div><Input label="Payment Date" type="date" value={payment.date} onChange={v=>setPayment({...payment, date:v})} /></div>
                <div><Input label="Reference / Last 4" value={payment.reference} onChange={v=>setPayment({...payment, reference:v})} placeholder="Optional" /></div>
              </div>
            </div>
          </section>
        )}

        {page===3 && (
          <section className="bg-white rounded-2xl shadow p-4 md:p-6">
            <div id="receipt-print">
              <BrandHeader biz={biz} />
              <h2 className="text-lg font-semibold mb-4 text-center">Payment Receipt</h2>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <ReadOnly label="Invoice #" value={String(invoice.invoiceNumber)} />
                <ReadOnly label="Payment Date" value={payment.date} />
                <ReadOnly label="Service Day" value={weekdayAndDate(reg.serviceDate)} />
                <ReadOnly label="Method" value={payment.method} />
                {payment.reference && <ReadOnly label="Reference" value={payment.reference} />}
              </div>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <ReadOnly label="Received From" value={`${reg.firstName} ${reg.lastName}`} />
                <ReadOnly label="Contact" value={`${reg.phone} • ${reg.email}`} />
                <ReadOnly label="Address" value={`${reg.address}, ${reg.city}, ${reg.state} ${reg.zip}`} className="md:col-span-2" />
              </div>
              <div className="bg-gray-50 rounded-2xl p-4">
                <div className="flex justify-between text-base font-semibold"><span>Amount Received</span><span>{currency(payment.amount)}</span></div>
                <p className="text-sm text-gray-600 mt-2">Thank you for your business.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-end mt-6">
              <button onClick={()=>openPdfFromElement(document.getElementById('receipt-print'), `Receipt-${invoice.invoiceNumber}`)} className="rounded-xl px-4 py-2 bg-gray-900 text-white hover:bg-black">Download PDF</button>
              <button onClick={()=>setPage(2)} className="rounded-xl px-4 py-2 bg-gray-200 hover:bg-gray-300">Back to Invoice</button>
            </div>
          </section>
        )}
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/30 flex items-end md:items-center md:justify-center p-4" onClick={()=>setShowSettings(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl p-4" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Settings</h3>
              <button onClick={()=>setShowSettings(false)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4 text-sm flex-wrap">
              <TabBtn active={settingsTab==='services'} onClick={()=>setSettingsTab('services')}>Services</TabBtn>
              <TabBtn active={settingsTab==='methods'} onClick={()=>setSettingsTab('methods')}>Payment Methods</TabBtn>
              <TabBtn active={settingsTab==='branding'} onClick={()=>setSettingsTab('branding')}>Branding</TabBtn>
              <TabBtn active={settingsTab==='customers'} onClick={()=>setSettingsTab('customers')}>Customers</TabBtn>
              <TabBtn active={settingsTab==='plans'} onClick={()=>setSettingsTab('plans')}>Plans</TabBtn>
              <TabBtn active={settingsTab==='data'} onClick={()=>setSettingsTab('data')}>Data (Backup)</TabBtn>
            </div>

            {settingsTab==='services' && (
              <div>
                <label className="block text-sm font-medium mb-1">Add a new service</label>
                <div className="flex gap-2">
                  <input className="flex-1 border rounded-xl px-3 py-2" value={newService} onChange={e=>setNewService(e.target.value)} placeholder="e.g., Weekly Scoop" />
                  <button onClick={()=>{ const s=newService.trim(); if(!s) return; if(!services.includes(s)) setServices(prev=>[...prev, s]); setNewService(''); }} className="rounded-xl px-4 py-2 bg-blue-600 text-white hover:bg-blue-700">Add</button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Tap a service to select it, then tap the trash can to delete. No limit.</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {services.length===0 && <span className="text-sm text-gray-500">No services yet.</span>}
                  {services.map((s,i)=>{
                    const picked = selectedForDelete.includes(s);
                    return (
                      <button key={i} onClick={()=> setSelectedForDelete(prev=> prev.includes(s)? prev.filter(x=>x!==s): [...prev,s])} className={classNames("px-3 py-1 rounded-full border", picked?"bg-red-50 border-red-300 text-red-700":"bg-gray-50 hover:bg-gray-100")}>{s}</button>
                    );
                  })}
                </div>
                <div className="flex justify-between items-center mt-6">
                  <button onClick={()=>{ if(!selectedForDelete.length) return; const remaining = services.filter(s=>!selectedForDelete.includes(s)); setServices(remaining); setSelectedForDelete([]); }} disabled={!selectedForDelete.length} className={classNames("inline-flex items-center gap-2 rounded-xl px-3 py-2", selectedForDelete.length?"bg-red-600 text-white hover:bg-red-700":"bg-gray-200 text-gray-500 cursor-not-allowed")}> 🗑️ Delete selected </button>
                  <button onClick={()=>setShowSettings(false)} className="rounded-xl px-4 py-2 bg-gray-200 hover:bg-gray-300">Done</button>
                </div>
              </div>
            )}

            {settingsTab==='methods' && (
              <div>
                <div className="mt-1"><h4 className="text-sm font-semibold">Payment Links</h4></div>
                <label className="block text-sm font-medium mb-1 mt-1">Add a payment link</label>
                <div className="grid md:grid-cols-3 gap-2">
                  <input className="border rounded-xl px-3 py-2" value={pmLabel} onChange={e=>setPmLabel(e.target.value)} placeholder="Label (e.g., Cashapp)" />
                  <input className="md:col-span-2 border rounded-xl px-3 py-2" value={pmUrl} onChange={e=>setPmUrl(e.target.value)} placeholder="https://..." />
                </div>
                <div className="flex justify-end mt-2"><button onClick={()=>{ const label=pmLabel.trim(); const url=pmUrl.trim(); if(!label||!url) return; setPaymentLinks(prev=>[...prev,{label,url}]); setPmLabel(''); setPmUrl(''); }} className="rounded-xl px-4 py-2 bg-blue-600 text-white hover:bg-blue-700">Add Link</button></div>
                <div className="mt-3">
                  {paymentLinks.length===0 && <p className="text-sm text-gray-500">No payment links yet.</p>}
                  <ul className="space-y-2">
                    {paymentLinks.map((l, idx)=> (
                      <li key={idx} className="flex items-center justify-between gap-3 border rounded-xl px-3 py-2">
                        <div className="truncate"><span className="font-medium">{l.label}</span> — <a className="text-blue-600 hover:underline" href={l.url} target="_blank" rel="noopener noreferrer">{l.url}</a></div>
                        <button onClick={()=>setPaymentLinks(prev=> prev.filter((_,i)=>i!==idx))} className="p-2 rounded-lg hover:bg-red-50 text-red-600" aria-label="Delete">🗑️</button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex justify-end mt-6"><button onClick={()=>setShowSettings(false)} className="rounded-xl px-4 py-2 bg-gray-200 hover:bg-gray-300">Done</button></div>
              </div>
            )}

            {settingsTab==='branding' && (
              <div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2"><h4 className="text-sm font-semibold">Business Branding</h4></div>
                  <div><label className="block text-sm font-medium mb-1">Business Name</label><input className="w-full border rounded-xl px-3 py-2" value={biz.name} onChange={e=>setBiz({...biz, name:e.target.value})} placeholder="Your Business LLC" /></div>
                  <div><label className="block text-sm font-medium mb-1">Phone</label><input className="w-full border rounded-xl px-3 py-2" value={biz.phone} onChange={e=>setBiz({...biz, phone:e.target.value})} placeholder="(555) 555-5555" /></div>
                  <div><label className="block text-sm font-medium mb-1">Email</label><input className="w-full border rounded-xl px-3 py-2" value={biz.email} onChange={e=>setBiz({...biz, email:e.target.value})} placeholder="you@example.com" /></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Address</label><input className="w-full border rounded-xl px-3 py-2" value={biz.address} onChange={e=>setBiz({...biz, address:e.target.value})} placeholder="123 Main St, City, ST 12345" /></div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Logo (URL)</label>
                    <input className="w-full border rounded-xl px-3 py-2" value={biz.logoUrl} onChange={e=>setBiz({...biz, logoUrl:e.target.value})} placeholder="https://..." />
                    <p className="text-xs text-gray-500 mt-1">Or upload an image file:</p>
                    <input type="file" accept="image/*" className="mt-1" onChange={e=>{ const file=e.target.files&&e.target.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=()=> setBiz({...biz, logoUrl:String(reader.result)}); reader.readAsDataURL(file); }} />
                  </div>
                  <div className="flex items-center justify-center gap-3">{biz.logoUrl ? <img src={biz.logoUrl} alt="logo preview" className="w-16 h-16 object-contain rounded-xl border"/> : <div className="w-16 h-16 rounded-xl border flex items-center justify-center text-xs text-gray-400">No logo</div>}</div>
                </div>
                <div className="flex justify-end mt-6"><button onClick={()=>setShowSettings(false)} className="rounded-xl px-4 py-2 bg-gray-200 hover:bg-gray-300">Done</button></div>
              </div>
            )}

            {settingsTab==='customers' && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Add / Edit Customer</h4>
                <div className="grid md:grid-cols-4 gap-3">
                  <input className="border rounded-xl px-3 py-2" placeholder="First name" value={custForm.firstName} onChange={e=>setCustForm({...custForm, firstName:e.target.value})} />
                  <input className="border rounded-xl px-3 py-2" placeholder="Last name" value={custForm.lastName} onChange={e=>setCustForm({...custForm, lastName:e.target.value})} />
                  <input className="border rounded-xl px-3 py-2" placeholder="Phone" value={custForm.phone} onChange={e=>setCustForm({...custForm, phone:e.target.value})} />
                  <input className="border rounded-xl px-3 py-2" placeholder="Email" value={custForm.email} onChange={e=>setCustForm({...custForm, email:e.target.value})} />
                  <div className="md:col-span-4 text-xs text-gray-600">Preferred Contact</div>
                  <div className="md:col-span-4 flex gap-4 text-sm">
                    {['Call','Text','Email'].map(opt => (
                      <label key={opt} className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={(custForm.preferred||[]).includes(opt)} onChange={e=>{
                          const set = new Set(custForm.preferred||[]);
                          if(e.target.checked) set.add(opt); else set.delete(opt);
                          setCustForm({...custForm, preferred: Array.from(set)});
                        }} /> {opt}
                      </label>
                    ))}
                  </div>
                  <div className="md:col-span-4 text-xs text-gray-600">Billing Address</div>
                  <input className="border rounded-xl px-3 py-2" placeholder="Address" value={custForm.billing.address} onChange={e=>setCustForm({...custForm, billing:{...custForm.billing, address:e.target.value}})} />
                  <input className="border rounded-xl px-3 py-2" placeholder="City" value={custForm.billing.city} onChange={e=>setCustForm({...custForm, billing:{...custForm.billing, city:e.target.value}})} />
                  <select className="border rounded-xl px-3 py-2" value={custForm.billing.state} onChange={e=>setCustForm({...custForm, billing:{...custForm.billing, state:e.target.value}})}>{statesUS.map(s=> <option key={s} value={s}>{s}</option>)}</select>
                  <input className="border rounded-xl px-3 py-2" placeholder="ZIP" value={custForm.billing.zip} onChange={e=>setCustForm({...custForm, billing:{...custForm.billing, zip:e.target.value}})} />
                  <div className="md:col-span-4 text-xs text-gray-600">Service Address</div>
                  <input className="border rounded-xl px-3 py-2" placeholder="Address" value={custForm.service.address} onChange={e=>setCustForm({...custForm, service:{...custForm.service, address:e.target.value}})} />
                  <input className="border rounded-xl px-3 py-2" placeholder="City" value={custForm.service.city} onChange={e=>setCustForm({...custForm, service:{...custForm.service, city:e.target.value}})} />
                  <select className="border rounded-xl px-3 py-2" value={custForm.service.state} onChange={e=>setCustForm({...custForm, service:{...custForm.service, state:e.target.value}})}>{statesUS.map(s=> <option key={s} value={s}>{s}</option>)}</select>
                  <input className="border rounded-xl px-3 py-2" placeholder="ZIP" value={custForm.service.zip} onChange={e=>setCustForm({...custForm, service:{...custForm.service, zip:e.target.value}})} />
                  <div className="md:col-span-4">
                    <label className="block text-sm font-medium mb-1">Default Services</label>
                    <MultiSelect options={services} selected={custForm.defaultServices||[]} onToggle={(opt)=>{
                      const exists = (custForm.defaultServices||[]).includes(opt);
                      setCustForm({...custForm, defaultServices: exists ? custForm.defaultServices.filter(s=>s!==opt) : [...(custForm.defaultServices||[]), opt]});
                    }} placeholder="Select services" />
                  </div>
                  <div className="md:col-span-4"><textarea className="w-full border rounded-xl px-3 py-2 min-h-[64px]" placeholder="Notes" value={custForm.notes} onChange={e=>setCustForm({...custForm, notes:e.target.value})} /></div>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button onClick={()=>{ setCustForm({...emptyCustomer}); }} className="rounded-xl px-3 py-2 bg-gray-200 hover:bg-gray-300">Clear</button>
                  <button onClick={()=>{
                    if(!custForm.firstName && !custForm.lastName) return;
                    if(custForm.id){ setCustomers(prev=> prev.map(c=> c.id===custForm.id ? {...custForm} : c)); }
                    else { const id=genId('cst'); setCustomers(prev=> [...prev, {...custForm, id}]); setCustForm({...emptyCustomer}); }
                  }} className="rounded-xl px-3 py-2 bg-blue-600 text-white hover:bg-blue-700">{custForm.id? 'Save Changes' : 'Add Customer'}</button>
                </div>

                <h4 className="text-sm font-semibold mt-6 mb-2">Customers</h4>
                <div className="max-h-64 overflow-auto border rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr><th className="p-2 text-left">Name</th><th className="p-2 text-left">Phone</th><th className="p-2 text-left">Email</th><th className="p-2 text-left">Actions</th></tr></thead>
                    <tbody>
                      {customers.map(c=> (
                        <tr key={c.id} className="border-t"><td className="p-2">{c.firstName} {c.lastName}</td><td className="p-2">{c.phone}</td><td className="p-2">{c.email}</td>
                          <td className="p-2">
                            <div className="flex gap-2">
                              <button onClick={()=>setCustForm({...c})} className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300">Edit</button>
                              <button onClick={()=>setCustomers(prev=> prev.filter(x=>x.id!==c.id))} className="px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200">Delete</button>
                            </div>
                          </td></tr>
                      ))}
                      {customers.length===0 && <tr><td className="p-3 text-sm text-gray-500" colSpan={4}>No customers yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {settingsTab==='plans' && (
              <PlansTab customers={customers} plans={plans} setPlans={setPlans} services={services} biz={biz} />
            )}

            {settingsTab==='data' && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Backup & Restore</h4>
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={()=>{
                    const data = { services, payment_links: paymentLinks, business_profile: biz, customers, plans, invoice_seq: ls.get('invoice_seq', 1000) };
                    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
                    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `backup-${todayISO()}.json`; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);
                  }} className="rounded-xl px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700">Export JSON</button>
                  <label className="inline-flex items-center gap-2 text-sm">Import JSON
                    <input type="file" accept="application/json" onChange={e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; const reader=new FileReader(); reader.onload=()=>{ try{ const obj=JSON.parse(String(reader.result||'{}')); if(obj.services) setServices(obj.services); if(obj.payment_links) setPaymentLinks(obj.payment_links); if(obj.business_profile) setBiz(obj.business_profile); if(obj.customers) setCustomers(obj.customers); if(obj.plans) setPlans(obj.plans); if(typeof obj.invoice_seq==='number') ls.set('invoice_seq', obj.invoice_seq); alert('Import complete'); }catch(err){ alert('Import failed: '+err); } }; reader.readAsText(f); }} className="block" />
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-3">Export includes services, payment links, branding, customers, plans, and invoice counter. Import overwrites current data with file contents.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save Prompt */}
      {showSavePrompt && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center md:justify-center p-4" onClick={()=>{/* require explicit choice */}}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5" onClick={e=>e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Save this person to Customers?</h3>
            <p className="text-sm text-gray-600">We can save this registration as a customer for next time.</p>
            <label className="flex items-center gap-2 mt-4 text-sm"><input type="checkbox" checked={dontAskAgain} onChange={e=>setDontAskAgain(e.target.checked)} /> Don't ask again</label>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={()=>handleSavePrompt('skip')} className="rounded-xl px-3 py-2 bg-gray-200 hover:bg-gray-300">Not now</button>
              <button onClick={()=>handleSavePrompt('save')} className="rounded-xl px-3 py-2 bg-blue-600 text-white hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Tips Modal (first run) */}
      {showTips && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center md:justify-center p-4" onClick={()=>{ /* require explicit continue */ }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-5" onClick={e=>e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Tips you should know</h3>
            <ul className="list-disc pl-5 text-sm space-y-2">
              <li>Open <b>Settings</b> → add your <b>Services</b> (first run is empty).</li>
              <li>Add <b>Payment Methods</b> and <b>Branding</b> (logo, contact). They appear on invoices, receipts, and PDFs.</li>
              <li>Use <b>Customers</b> to save recurring client details (billing vs service address) and preferred contact.</li>
              <li>Create <b>Plans</b> for recurring work; tap <b>Generate Invoice</b> when due. Pause/Resume any plan. Use the <b>.ics</b> button to add reminders to your calendar.</li>
            </ul>
            <label className="flex items-center gap-2 mt-4 text-sm"><input type="checkbox" checked={dontShowTips} onChange={e=>setDontShowTips(e.target.checked)} /> Don't show me again</label>
            <div className="flex justify-end gap-2 mt-4"><button onClick={()=>{ if(dontShowTips) ls.set("hide_tips", true); setShowTips(false); }} className="rounded-xl px-4 py-2 bg-blue-600 text-white hover:bg-blue-700">Continue</button></div>
          </div>
        </div>
      )}

      <footer className="text-center text-xs text-gray-500 py-6">© {new Date().getFullYear()} — Simple 3-Page App</footer>
    </div>
  );
}

// ---------- Subcomponents ----------
function PlansTab({customers, plans, setPlans, services, biz}){
  const [form, setForm] = useState({ id:'', customerId:'', name:'', frequency:'weekly', interval:1, startDate: todayISO(), nextDate: todayISO(), endDate:'', services:[], items:[], dueRule:{daysAfter:7}, active:true });
  function addOrUpdatePlan(){
    if(!form.customerId) return;
    const base = {...form};
    if(!base.id){ base.id = genId('pln'); if(!base.startDate) base.startDate = todayISO(); if(!base.nextDate) base.nextDate = base.startDate; setPlans(prev=>[...prev, base]); }
    else { setPlans(prev=> prev.map(p=> p.id===base.id ? base : p)); }
    setForm({ id:'', customerId:'', name:'', frequency:'weekly', interval:1, startDate: todayISO(), nextDate: todayISO(), endDate:'', services:[], items:[], dueRule:{daysAfter:7}, active:true });
  }
  function deletePlan(id){ setPlans(prev=> prev.filter(p=>p.id!==id)); }
  function togglePlanActive(id){ setPlans(prev=> prev.map(p=> p.id===id ? {...p, active: !p.active} : p)); }
  function advancePlanNextDate(id){ setPlans(prev=> prev.map(p=> p.id===id ? {...p, nextDate: nextOccurrence(p.nextDate||p.startDate, p)} : p)); }
  function downloadPlanIcs(plan){ const c = customers.find(x=>x.id===plan.customerId); const ics = icsForPlan(plan, c, biz); const fname = `${(plan.name||'Plan')}-${c? (c.firstName+'-'+c.lastName):'Customer'}.ics`.replace(/\s+/g,'_'); const blob = new Blob([ics], {type:'text/calendar'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); }
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">Create / Edit Plan</h4>
      <div className="grid md:grid-cols-6 gap-3">
        <div className="md:col-span-2">
          <label className="block text-sm">Customer</label>
          <select className="w-full border rounded-xl px-3 py-2" value={form.customerId} onChange={e=>setForm({...form, customerId:e.target.value})}>
            <option value="">— Select —</option>
            {customers.map(c=> <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>
        </div>
        <div className="md:col-span-2"><label className="block text-sm">Plan Name</label><input className="w-full border rounded-xl px-3 py-2" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="e.g., Jane Weekly"/></div>
        <div><label className="block textsm">Frequency</label>
          <select className="w-full border rounded-xl px-3 py-2" value={form.frequency} onChange={e=>setForm({...form, frequency:e.target.value})}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="customDays">Every N Days</option>
          </select>
        </div>
        <div><label className="block text-sm">Interval</label><input type="number" min={1} className="w-full border rounded-xl px-3 py-2" value={form.interval} onChange={e=>setForm({...form, interval:Number(e.target.value)||1})} /></div>
        <div><label className="block text-sm">Start</label><input type="date" className="w-full border rounded-xl px-3 py-2" value={form.startDate} onChange={e=>setForm({...form, startDate:e.target.value})} /></div>
        <div><label className="block text-sm">Next</label><input type="date" className="w-full border rounded-xl px-3 py-2" value={form.nextDate} onChange={e=>setForm({...form, nextDate:e.target.value})} /></div>
        <div><label className="block text-sm">End (optional)</label><input type="date" className="w-full border rounded-xl px-3 py-2" value={form.endDate||''} onChange={e=>setForm({...form, endDate:e.target.value})} /></div>
        <div><label className="block text-sm">Due (days after)</label><input type="number" min={0} className="w-full border rounded-xl px-3 py-2" value={form.dueRule.daysAfter} onChange={e=>setForm({...form, dueRule:{daysAfter:Number(e.target.value)||0}})} /></div>
        <div className="md:col-span-6">
          <label className="block text-sm font-medium mb-1">Services</label>
          <MultiSelect options={services} selected={form.services} onToggle={(opt)=>{
            const exists = (form.services||[]).includes(opt);
            setForm({...form, services: exists ? form.services.filter(s=>s!==opt) : [...(form.services||[]), opt]});
          }} placeholder="Select services" />
        </div>
        <div className="md:col-span-6">
          <label className="block text-sm font-medium mb-1">Items</label>
          <PlanItemsEditor items={form.items} setItems={(items)=>setForm({...form, items})} />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={()=>setForm({ id:'', customerId:'', name:'', frequency:'weekly', interval:1, startDate: todayISO(), nextDate: todayISO(), endDate:'', services:[], items:[], dueRule:{daysAfter:7}, active:true })} className="rounded-xl px-3 py-2 bg-gray-200 hover:bg-gray-300">Clear</button>
        <button onClick={addOrUpdatePlan} className="rounded-xl px-3 py-2 bg-blue-600 text-white hover:bg-blue-700">{form.id? 'Save Changes' : 'Add Plan'}</button>
      </div>

      <h4 className="text-sm font-semibold mt-6 mb-2">Plans</h4>
      <div className="max-h-72 overflow-auto border rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="p-2 text-left">Plan</th><th className="p-2 text-left">Customer</th><th className="p-2 text-left">Next</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Actions</th></tr></thead>
          <tbody>
            {plans.map(p=>{
              const c = customers.find(x=>x.id===p.customerId);
              return (
                <tr key={p.id} className="border-t">
                  <td className="p-2">{p.name || '(no name)'} <span className="text-xs text-gray-500">{p.frequency}×{p.interval}</span></td>
                  <td className="p-2">{c? `${c.firstName} ${c.lastName}`: '—'}</td>
                  <td className="p-2">{p.nextDate}</td>
                  <td className="p-2">{p.active? <span className="text-green-700">Active</span> : <span className="text-gray-500">Paused</span>}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={()=>setForm({...p})} className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300">Edit</button>
                      <button onClick={()=>setPlans(prev=> prev.map(x=> x.id===p.id ? {...x, active: !x.active} : x))} className={classNames("px-2 py-1 rounded", p.active?"bg-yellow-100 text-yellow-800 hover:bg-yellow-200":"bg-green-100 text-green-800 hover:bg-green-200")}>{p.active? 'Pause' : 'Resume'}</button>
                      <button onClick={()=>downloadPlanIcs(p)} className="px-2 py-1 rounded bg-white border hover:bg-gray-50">.ics</button>
                      <button onClick={()=>setPlans(prev=> prev.map(x=> x.id===p.id ? {...x, nextDate: nextOccurrence(x.nextDate||x.startDate, x)} : x))} className="px-2 py-1 rounded bg-white border hover:bg-gray-50">Advance Next</button>
                      <button onClick={()=>setPlans(prev=> prev.filter(x=>x.id!==p.id))} className="px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200">Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {plans.length===0 && <tr><td className="p-3 text-sm text-gray-500" colSpan={5}>No plans yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StepPill({label, active, onClick}){ return (<button onClick={onClick} className={classNames("px-3 py-1.5 rounded-full border", active?"bg-blue-600 text-white border-blue-600":"bg-white hover:bg-gray-50")}>{label}</button>); }
function TabBtn({children, active, onClick}){ return (<button onClick={onClick} className={classNames("px-3 py-1.5 rounded-full border", active?"bg-blue-600 text-white border-blue-600":"bg-white hover:bg-gray-50")}>{children}</button>); }
function Input({label, value, onChange, type="text", placeholder, required, className, pattern}){ return (<div className={className}><label className="block text-sm font-medium mb-1">{label}{required && <span className="text-red-500">*</span>}</label><input className="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring" value={value} onChange={e=>onChange(e.target.value)} type={type} placeholder={placeholder} required={required} pattern={pattern} /></div>); }
function ReadOnly({label, value, className}){ return (<div className={className}><label className="block text-sm text-gray-600">{label}</label><div className="mt-1 font-medium">{value || "—"}</div></div>); }
function MultiSelect({options, selected, onToggle, placeholder}){ const [open, setOpen] = useState(false); return (<div className="relative"><div className="flex flex-wrap gap-2 border rounded-xl px-3 py-2 min-h-[44px] cursor-pointer bg-white" onClick={()=>setOpen(o=>!o)}>{selected.length===0 ? <span className="text-gray-400">{placeholder}</span> : selected.map((s,i)=>(<span key={i} className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs border border-blue-200">{s}</span>))}<span className="ml-auto text-gray-500">▾</span></div>{open && (<div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto bg-white border rounded-xl shadow">{options.length===0 && (<div className="p-3 text-sm text-gray-500">No options yet. Add in Settings.</div>)}{options.map((opt,i)=>{ const isSel = selected.includes(opt); return (<button key={i} onClick={()=>onToggle(opt)} className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"><span className={classNames("inline-flex h-4 w-4 items-center justify-center border rounded", isSel?"bg-blue-600 border-blue-600 text-white":"bg-white")}>{isSel?"✓":""}</span><span>{opt}</span></button>); })}</div>)}</div>); }
function BrandHeader({biz}){ if(!biz?.name && !biz?.logoUrl && !biz?.phone && !biz?.email && !biz?.address) return null; return (
  <div className="brand">
    <div>{biz.logoUrl ? <img src={biz.logoUrl} alt="logo"/> : <div style={{width:72,height:72}} className="rounded-xl border flex items-center justify-center text-[10px] text-gray-400">Logo</div>}</div>
    <div className="name">{biz.name || ''}</div>
    <div className="meta">{[biz.phone, biz.email].filter(Boolean).join(' • ')}</div>
    <div className="meta">{biz.address || ''}</div>
  </div>
); }
function PlanItemsEditor({items, setItems}){
  const local = items && items.length ? items : [{desc:'',qty:1,price:0}];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50"><tr><th className="p-2 text-left">Description</th><th className="p-2 text-left">Qty</th><th className="p-2 text-left">Unit Price</th><th className="p-2 text-left">Actions</th></tr></thead>
        <tbody>
          {local.map((it, idx)=> (
            <tr key={idx} className="border-t">
              <td className="p-2"><input className="w-full border rounded-lg px-2 py-1" value={it.desc} onChange={e=>{ const arr=[...local]; arr[idx]={...arr[idx], desc:e.target.value}; setItems(arr); }} placeholder="Service or product"/></td>
              <td className="p-2"><input type="number" min={0} className="w-24 border rounded-lg px-2 py-1" value={it.qty} onChange={e=>{ const arr=[...local]; arr[idx]={...arr[idx], qty:e.target.value}; setItems(arr); }} /></td>
              <td className="p-2"><input type="number" min={0} step="0.01" className="w-28 border rounded-lg px-2 py-1" value={it.price} onChange={e=>{ const arr=[...local]; arr[idx]={...arr[idx], price:e.target.value}; setItems(arr); }} /></td>
              <td className="p-2">
                <div className="flex gap-2">
                  <button className="px-3 py-1 rounded-lg bg-gray-200 hover:bg-gray-300" onClick={()=>{ const arr=[...local]; arr.splice(idx+1,0,{desc:'',qty:1,price:0}); setItems(arr); }}>Add Row</button>
                  <button className="px-3 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200" onClick={()=>{ const arr=[...local]; arr.splice(idx,1); setItems(arr.length?arr:[{desc:'',qty:1,price:0}]); }}>Remove</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GearIcon(){ return (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.065 2.572c.94 1.543-.827 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.827-2.37-2.37a1.724 1.724 0 00-1.066-2.572c-1.756-.426-1.756-2.924 0-3.35.46-.111.86-.411 1.066-.82z"/></svg>); }
function LinkIcon(){ return (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M10.59 13.41a1 1 0 010-1.41l2.59-2.59a1 1 0 111.41 1.41l-2.59 2.59a1 1 0 01-1.41 0z"/><path d="M12.88 4.12a5 5 0 017.07 7.07l-1.76 1.76a1 1 0 01-1.41-1.41l1.76-1.76a3 3 0 10-4.24-4.24l-1.76 1.76a1 1 0 11-1.41-1.41l1.76-1.76z"/><path d="M4.05 12.05a5 5 0 017.07 0 1 1 0 11-1.41 1.41 3 3 0 00-4.24 0l-1.76 1.76a3 3 0 104.24 4.24l1.76-1.76a1 1 0 111.41 1.41l-1.76 1.76a5 5 0 11-7.07-7.07l1.76-1.76z"/></svg>); }

// ---------- Self-test suite ----------
function runSelfTests(){
  // These tests only touch a *test* key so your real invoice counter isn't affected.
  const KEY = 'invoice_seq_test';
  const start = 2000;
  ls.set(KEY, start);
  const a = nextInvoiceNumberWithKey(KEY);
  const b = nextInvoiceNumberWithKey(KEY);
  const c = nextInvoiceNumberWithKey(KEY);
  const pass1 = (a===start+1 && b===start+2 && c===start+3);
  const pass2 = (Number(ls.get(KEY, 0)) === start+3);
  // Clean up test key
  try { localStorage.removeItem(KEY); } catch {}
  // Report
  // eslint-disable-next-line no-console
  console.log(`Self-tests: invoice sequence ${pass1 && pass2 ? 'PASS' : 'FAIL'}`, {a,b,c});
}

// === END YOUR APP CODE ===


// 4) Tiny mount API the Canvas stub will call
export function mount(el){
ensureBootstrap();
const root = ReactDOM.createRoot(el);
root.render(React.createElement(App));
return () => root.unmount();
}
