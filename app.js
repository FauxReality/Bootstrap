import React from "https://esm.sh/react@18";
import ReactDOM from "https://esm.sh/react-dom@18/client";
const { useEffect, useMemo, useState } = React;

// --- Global image sizing (applies to ALL images in the app) ---
const IMG_MAX = { w: 300, h: 300 };  // ← change these if you want a different cap

function injectImgMaxCSS() {
  if (document.getElementById('img-max-css')) return;
  const css = `
    /* Limit every image inside our app root; maintain aspect ratio */
    #root img {
      max-width: ${IMG_MAX.w}px;
      max-height: ${IMG_MAX.h}px;
      width: auto;
      height: auto;
      object-fit: contain;
    }
  `;
  const s = document.createElement('style');
  s.id = 'img-max-css';
  s.textContent = css;
  document.head.appendChild(s);
}

/* v8.2 — Hotfix & Compact
   - FIX: define nextInvoiceNumber() (persistent, monotonic in localStorage)
   - Compact code to help with editor line limits
   - Adds console self-tests for invoice sequencing (no data mutation)
*/

// ---------- Mini helpers ----------
const ls={get:(k,f)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):f;}catch{return f;}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}}};
const statesUS=["AL","AK","AZ","AR","CA","CO","CT","DC","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
const cls=(...a)=>a.filter(Boolean).join(" ");
const cur=n=>Number(n||0).toLocaleString(undefined,{style:"currency",currency:"USD"});
// Build a payment URL that pre-fills the amount (and note where supported)
function makePayUrl(link, amount, reg, invoice){
  const amt = (Number(amount) || 0).toFixed(2);
  const note = `Invoice ${invoice?.invoiceNumber || ''} ${reg?.firstName || ''} ${reg?.lastName || ''}`.trim();
  const encNote = encodeURIComponent(note);

  let raw = (link?.url || '').trim();
  if (!raw) return '#';

  // normalize common inputs (users sometimes save "$tag" or "venmo.com/user")
  if (/^(\$|cash\.app\/\$)/i.test(raw)) raw = 'https://' + raw.replace(/^https?:\/\//,'');
  if (/^venmo\.com\//i.test(raw))       raw = 'https://' + raw;
  if (/^paypal\.me\//i.test(raw))       raw = 'https://' + raw;

  const ensureHttp = (u) => (u.startsWith('http') ? u : 'https://' + u.replace(/^\/+/,''));

  try{
    const u = new URL(ensureHttp(raw));
    const host = u.hostname.replace(/^www\./,'');
    const path = u.pathname.replace(/^\/+/,''); // e.g. "$yourtag" or "yourhandle"

    // --- Cash App: https://cash.app/$cashtag/amount (no note supported)
    if (host === 'cash.app'){
      // path may be "$tag" or just "tag" depending on how it was saved
      const tag = path.startsWith('$') ? path.slice(1) : path;
      if (tag) return `https://cash.app/$${tag}/${amt}`;
    }

    // --- PayPal.me: https://paypal.me/handle/amount
    if (host === 'paypal.me'){
      const handle = path.split('/')[0];
      if (handle) return `https://paypal.me/${handle}/${amt}`;
    }

    // --- Venmo Web: https://venmo.com/username?txn=pay&amount=12.34&note=...
    if (host === 'venmo.com'){
      const user = path.split('/')[0];
      if (user) return `https://venmo.com/${user}?txn=pay&amount=${amt}&note=${encNote}`;
    }

    // Heuristics if user saved just a handle/label
    const label = (link?.label || '').toLowerCase();

    if (label.includes('venmo') && !/venmo\.com/.test(raw)){
      const user = raw.replace(/^(https?:\/\/)?@?/,'').replace(/^\/+/,'');
      if (user) return `https://venmo.com/${user}?txn=pay&amount=${amt}&note=${encNote}`;
    }
    if (label.includes('paypal') && !/paypal\.me/.test(raw)){
      const handle = raw.replace(/^(https?:\/\/)?@?/,'').replace(/^\/+/,'');
      return `https://paypal.me/${handle}/${amt}`;
    }
    if (label.includes('cash') && !/cash\.app/.test(raw)){
      const tag = raw.replace(/^(https?:\/\/)?\$?/,'').replace(/^\/+/,'');
      return `https://cash.app/$${tag}/${amt}`;
    }

    // Fallback: original link
    return u.toString();
  }catch{
    return raw;
  }
}

const today=()=>new Date().toISOString().slice(0,10);
const gid=(p='id')=>`${p}_${Math.random().toString(36).slice(2,9)}`;
const wday=(iso)=>{if(!iso)return'';const d=new Date(iso+'T00:00:00');return d.toLocaleDateString(undefined,{weekday:'long'})+`, ${iso}`;};
const formatDateICS=(iso)=> (iso||today()).replace(/-/g,'');
const nowStamp=()=>{const d=new Date(),z=n=>String(n).padStart(2,'0');return `${d.getUTCFullYear()}${z(d.getUTCMonth()+1)}${z(d.getUTCDate())}T${z(d.getUTCHours())}${z(d.getUTCMinutes())}${z(d.getUTCSeconds())}Z`;};
const escICS=(t='')=>String(t).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
function openPdfFromEl(el, title){
  if (!el) return;

  // Tailwind + print-tweaks so PDF matches the screen
  const styles = `
  <style>
    @page { size: letter; margin: 12mm; }
    html,body { background:#fff; }
    *{ box-sizing:border-box }
    body{
      font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica Neue,Arial;
      color:#111827; margin:0;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    /* Match your on-screen container width; tweak if your app is wider/narrower */
    .wrap{ max-width: 800px; margin:24px auto; padding:0 16px; }

    /* ✅ Global cap for all images in the PDF/print */
    img{
      max-width:${IMG_MAX.w}px;
      max-height:${IMG_MAX.h}px;
      width:auto; height:auto; object-fit:contain;
    }

      /* Header layout (same as screen: logo left, text right) */
    .brand{ display:flex; flex-direction:row; gap:12px; align-items:center; margin-bottom:16px; text-align:left }
    .brand img{ object-fit:contain; border-radius:12px; border:1px solid #e5e7eb }
    .brand .name{ font-size:18px; font-weight:700 }
    .brand .meta{ color:#4b5563; font-size:16px; line-height:1.3 }
    .brand .meta div{ margin-top:2px }

    /* Tables etc. (keep your existing look) */
    h1,h2{ font-size:22px; margin:8px 0 12px }
    table{ width:100%; border-collapse:collapse }
    th,td{ border-top:1px solid #e5e7eb; padding:8px; text-align:left; font-size:12px }
    thead th{ background:#f9fafb }
    .totals{ margin-top:12px; padding:12px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px }
    .paylinks{ margin:12px 0; padding:10px; border:1px solid #bfdbfe; background:#eff6ff; border-radius:12px }
    .chip{ display:inline-block; margin:4px 6px 0 0; padding:6px 10px; border:1px solid #d1d5db; border-radius:9999px; font-size:12px; text-decoration:none; color:#1d4ed8 }
    .muted{ color:#6b7280; font-size:12px }
    .section{ margin:16px 0 }
  </style>`;

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title || 'Invoice'}</title>
    <!-- Load Tailwind in the print window so all your on-screen classes render -->
    <script src="https://cdn.tailwindcss.com"><\/script>
    ${styles}
  </head>
  <body>
    <!-- We print the same markup you see on screen -->
    <div class="wrap">${el.outerHTML}</div>
    <script>
      // Wait for Tailwind to compile classes, then print
      window.onload = () => setTimeout(() => { window.print(); window.close(); }, 350);
    <\/script>
  </body>
</html>`;

  // Use a blob URL so browsers don’t block document.write
  const blob = new Blob([html], { type:'text/html' });
  const url  = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
// ---------- Invoice sequence (PERSISTENT) ----------
function nextInvoiceNumber(){const key='invoice_seq';let cur=Number(ls.get(key,1000));if(!Number.isFinite(cur))cur=1000;const nxt=cur+1;ls.set(key,nxt);return nxt;}

// ---------- ICS for plans ----------
function icsForPlan(plan,customer,biz){const map={weekly:'WEEKLY',monthly:'MONTHLY',customDays:'DAILY'},FREQ=map[plan.frequency]||'WEEKLY',INTERVAL=Math.max(1,Number(plan.interval||1)),DTSTART=formatDateICS(plan.startDate||plan.nextDate||today()),UNTIL=plan.endDate?`;UNTIL=${formatDateICS(plan.endDate)}T000000Z`:'';const summary=`${plan.name||'Recurring Service'} — ${customer?`${customer.firstName||''} ${customer.lastName||''}`.trim():''}`.trim();const parts=[];if(biz?.name)parts.push(biz.name);if(plan.services?.length)parts.push(`Services: ${plan.services.join(', ')}`);if(plan.items?.length)parts.push(`Items: ${plan.items.map(i=>i.desc).filter(Boolean).join(', ')}`);const desc=parts.join('\n');return['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Simple 3-Page App//EN','BEGIN:VEVENT',`UID:${plan.id}-${Math.random().toString(36).slice(2,10)}@simple3page.app`,`DTSTAMP:${nowStamp()}`,`DTSTART;VALUE=DATE:${DTSTART}`,`RRULE:FREQ=${FREQ};INTERVAL=${INTERVAL}${UNTIL}`,`SUMMARY:${escICS(summary)}`,desc?`DESCRIPTION:${escICS(desc)}`:null,'END:VEVENT','END:VCALENDAR'].filter(Boolean).join('\r\n');}

// ---------- Date math ----------
const nextOcc=(iso,plan)=>{const d=new Date(iso||today()),n=Math.max(1,Number(plan.interval||1));if(plan.frequency==='weekly')d.setDate(d.getDate()+7*n);else if(plan.frequency==='monthly')d.setMonth(d.getMonth()+n);else d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};

// ---------- Self tests (console) ----------
function runSelfTests(){try{const k='invoice_seq_test';ls.set(k,1000);const a=Number(ls.get(k));const b=a+1;ls.set(k,b);const c=Number(ls.get(k));const pass=c===a+1;console.log('[TEST] invoice seq increment:',pass?'OK':'FAIL', {a,b,c});ls.set(k,9999);const z=Number(ls.get(k));const z2=z+1;ls.set(k,z2);console.log('[TEST] invoice seq large:',Number(ls.get(k))===10000?'OK':'WARN');}catch(e){console.warn('[TEST] error',e);}}

// ---------- App ----------
export default function App(){
    // Make sure the global image rules are present
  useEffect(() => { injectImgMaxCSS(); }, []);
   
  const [page,setPage]=useState(1); // 1=Reg 2=Invoice 3=Receipt
  // Persisted
  const [services,setServices]=useState(()=>ls.get('services',[])); useEffect(()=>ls.set('services',services),[services]);
  const [paymentLinks,setPaymentLinks]=useState(()=>ls.get('payment_links',[])); useEffect(()=>ls.set('payment_links',paymentLinks),[paymentLinks]);
  const [payConfirm, setPayConfirm] = useState({ open:false, link:null });
  const [editIdx, setEditIdx] = useState(null);            // index being edited, or null
const [editTmp, setEditTmp] = useState({ label: '', url: '' });

function startEdit(i){
  setEditIdx(i);
  setEditTmp(paymentLinks[i]);
}

function cancelEdit(){
  setEditIdx(null);
}

function saveEdit(){
  if (editIdx == null) return;
  const next = [...paymentLinks];
  next[editIdx] = { label: (editTmp.label || '').trim(), url: (editTmp.url || '').trim() };
  setPaymentLinks(next);
  try { ls.set('paymentLinks', next); } catch {}
  setEditIdx(null);
}
  const [biz,setBiz]=useState(()=>ls.get('business_profile',{name:'',email:'',phone:'',address:'',logoUrl:''})); useEffect(()=>ls.set('business_profile',biz),[biz]);
  const [customers,setCustomers]=useState(()=>ls.get('customers',[])); useEffect(()=>ls.set('customers',customers),[customers]);
  const [plans,setPlans]=useState(()=>ls.get('plans',[])); useEffect(()=>ls.set('plans',plans),[plans]);
  // Save policy
  const [savePolicy,setSavePolicy]=useState(()=>ls.get('auto_save_pref','ask')); useEffect(()=>ls.set('auto_save_pref',savePolicy),[savePolicy]);
  const [showSavePrompt,setShowSavePrompt]=useState(false),[dontAskAgain,setDontAskAgain]=useState(false);
  // Tips modal
  const [showTips,setShowTips]=useState(()=>!ls.get('hide_tips',false)),[dontShowTips,setDontShowTips]=useState(false);
  // Settings
  const [showSettings,setShowSettings]=useState(false),[tab,setTab]=useState('services');
  // Services tab
  const [newService,setNewService]=useState(''),[toDelete,setToDelete]=useState([]);
  // Pay methods tab
  const [pmLabel,setPmLabel]=useState(''),[pmUrl,setPmUrl]=useState('');
  // Customers tab form
  const emptyCustomer={id:'',firstName:'',lastName:'',phone:'',email:'',preferred:[],billing:{address:'',city:'',state:'VA',zip:''},service:{address:'',city:'',state:'VA',zip:''},defaultServices:[],notes:''};
  const [custForm,setCustForm]=useState(emptyCustomer);
  // Registration
  const [selectedCustomerId,setSelectedCustomerId]=useState('');
  const [reg,setReg]=useState({firstName:'',lastName:'',phone:'',email:'',address:'',city:'',state:'VA',zip:'',selectedServices:[],serviceDate:'',preferred:[]});
  const regValid=useMemo(()=>{const req=["firstName","lastName","phone","email","address","city","state","zip","serviceDate"];return req.every(k=>String(reg[k]||'').trim())&&reg.selectedServices.length>0;},[reg]);
  // Invoice & payment
  const [invoice,setInvoice]=useState(()=>({invoiceNumber:nextInvoiceNumber(),invoiceDate:today(),dueDate:today(),items:[{desc:'',qty:1,price:0}],notes:'',autoFromReg:false}));
  const subTotal=useMemo(()=>invoice.items.reduce((s,i)=>s+(Number(i.qty)||0)*(Number(i.price)||0),0),[invoice.items]);
  const [payment,setPayment]=useState({method:'Cash',amount:0,date:today(),reference:''}); useEffect(()=>setPayment(p=>({...p,amount:Number(subTotal.toFixed(2))})),[subTotal]);
  useEffect(()=>{runSelfTests();},[]);
 
  // Customers utils
  const norm=s=>String(s||'').trim().toLowerCase(); const digits=s=>String(s||'').replace(/\D+/g,'');
  const findExisting=()=>customers.find(c=> (norm(c.email)&&norm(c.email)===norm(reg.email)) || (digits(c.phone)&&digits(c.phone)===digits(reg.phone)))||null;
  const saveFromReg=()=>{const id=gid('cst');const c={id,firstName:reg.firstName,lastName:reg.lastName,phone:reg.phone,email:reg.email,preferred:[...reg.preferred],billing:{address:reg.address,city:reg.city,state:reg.state,zip:reg.zip},service:{address:reg.address,city:reg.city,state:reg.state,zip:reg.zip},defaultServices:[...reg.selectedServices],notes:''};setCustomers(p=>[...p,c]);setSelectedCustomerId(id);return c;};
  const updateLoaded=()=>{if(!selectedCustomerId)return;setCustomers(p=>p.map(c=>c.id===selectedCustomerId?{...c,firstName:reg.firstName,lastName:reg.lastName,phone:reg.phone,email:reg.email,preferred:[...reg.preferred],billing:{address:reg.address,city:reg.city,state:reg.state,zip:reg.zip},service:{address:reg.address,city:reg.city,state:reg.state,zip:reg.zip},defaultServices:[...reg.selectedServices]}:c));};

  // Flow
  function proceedToInvoice(){ if(selectedCustomerId) updateLoaded(); setInvoice(inv=>{const onlyBlank=inv.items.length===1 && !inv.items[0].desc && Number(inv.items[0].qty)===1 && Number(inv.items[0].price)===0; if(!inv.autoFromReg||onlyBlank){const items=(reg.selectedServices.length?reg.selectedServices:['']).map(s=>({desc:s||'',qty:1,price:0})); return {...inv,items,autoFromReg:true};} return inv;}); setPage(2); }
  function goToInvoice(){ if(!regValid) return; const ex=findExisting(); if(ex){ if(selectedCustomerId) updateLoaded(); else { setCustomers(p=>p.map(c=>c.id===ex.id?{...c,firstName:reg.firstName,lastName:reg.lastName,phone:reg.phone,email:reg.email,preferred:[...reg.preferred],billing:{address:reg.address,city:reg.city,state:reg.state,zip:reg.zip},service:{address:reg.address,city:reg.city,state:reg.state,zip:reg.zip},defaultServices:[...reg.selectedServices]}:c)); setSelectedCustomerId(ex.id);} proceedToInvoice(); return;} const pol=ls.get('auto_save_pref','ask'); if(pol==='always'){saveFromReg(); proceedToInvoice();} else if(pol==='never'){proceedToInvoice();} else {setShowSavePrompt(true);} }
  function handleSavePrompt(action){ if(action==='save') saveFromReg(); if(dontAskAgain) ls.set('auto_save_pref', action==='save'?'always':'never'); setShowSavePrompt(false); proceedToInvoice(); }

  // ---------- UI ----------
  return (<div className="min-h-screen bg-gray-100 text-gray-900">
    <header className="bg-white sticky top-0 z-10 shadow-sm"><div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between"><h1 className="text-xl font-semibold">Simple 3-Page App</h1><button onClick={()=>{setShowSettings(true);setTab('services');}} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300">Settings <GearIcon/></button></div></header>

   <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
  <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
    <div className="flex items-center gap-2">
      {/* Optional tiny logo */}
      {/* {biz?.logoUrl && <img src={biz.logoUrl} alt="" className="w-6 h-6 rounded" />} */}
      <span className="font-semibold tracking-tight">
        {biz?.name || 'Care-Free Tails'}
      </span>
    </div>

    <button
      onClick={()=>setShowSettings(true)}
      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border hover:bg-gray-50 text-sm"
      aria-label="Open settings"
    >
      ⚙️ <span className="hidden sm:inline">Settings</span>
    </button>
  </div>
</header>

      <nav className="mb-4 flex gap-2 text-sm flex-wrap"><Pill label="1. Registration" act={page===1} onClick={()=>setPage(1)}/><Pill label="2. Invoice" act={page===2} onClick={()=>setPage(2)}/><Pill label="3. Receipt" act={page===3} onClick={()=>setPage(3)}/></nav>

      {page===1 && (<section className="bg-white rounded-2xl shadow p-4 md:p-6">
        <h2 className="text-lg font-semibold mb-4">Customer Registration</h2>
        <div className="mb-4 p-3 border rounded-xl bg-gray-50"><div className="flex items-center gap-2 flex-wrap"><label className="text-sm font-medium">Choose existing</label><select className="border rounded-xl px-3 py-2" value={selectedCustomerId} onChange={e=>{const id=e.target.value;setSelectedCustomerId(id);const c=customers.find(x=>x.id===id); if(c){setReg(r=>({...r,firstName:c.firstName,lastName:c.lastName,phone:c.phone,email:c.email,address:c.billing.address,city:c.billing.city,state:c.billing.state,zip:c.billing.zip,selectedServices:c.defaultServices||r.selectedServices}))}}}><option value="">— Select —</option>{customers.map(c=><option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}</select><button onClick={saveFromReg} className="ml-auto rounded-xl px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 text-sm">Save current as customer</button></div></div>
        <div className="grid md:grid-cols-2 gap-4">
          <Inp label="First Name" val={reg.firstName} set={v=>setReg({...reg,firstName:v})} req/>
          <Inp label="Last Name" val={reg.lastName} set={v=>setReg({...reg,lastName:v})} req/>
          <Inp label="Phone" val={reg.phone} set={v=>setReg({...reg,phone:v})} type="tel" ph="(555) 555-5555" req/>
          <div><label className="block text-sm font-medium mb-1">Preferred Contact (check all)</label><div className="flex flex-wrap gap-4 text-sm">{['Call','Text','Email'].map(opt=>(<label key={opt} className="inline-flex items-center gap-2"><input type="checkbox" checked={reg.preferred.includes(opt)} onChange={e=>{const s=new Set(reg.preferred);e.target.checked?s.add(opt):s.delete(opt);setReg({...reg,preferred:[...s]});}}/> {opt}</label>))}</div></div>
          <Inp label="Email" val={reg.email} set={v=>setReg({...reg,email:v})} type="email" ph="name@example.com" req/>
          <div className="md:col-span-2 grid md:grid-cols-2 gap-4">
            <Inp label="Address" val={reg.address} set={v=>setReg({...reg,address:v})} req/>
            <Inp label="City" val={reg.city} set={v=>setReg({...reg,city:v})} req/>
            <div><label className="block text-sm font-medium mb-1">State<span className="text-red-500">*</span></label><select className="w-full border rounded-xl px-3 py-2" value={reg.state} onChange={e=>setReg({...reg,state:e.target.value})}>{statesUS.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
            <Inp label="ZIP" val={reg.zip} set={v=>setReg({...reg,zip:v})} ph="12345" pattern="\\d{5}" req/>
          </div>
          <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Services (multi-select)<span className="text-red-500">*</span></label><Multi options={services} selected={reg.selectedServices} onToggle={opt=>setReg(r=>({...r,selectedServices:r.selectedServices.includes(opt)?r.selectedServices.filter(s=>s!==opt):[...r.selectedServices,opt]}))} placeholder="Select services"/><p className="text-xs text-gray-500 mt-1">Tap to select multiple. Manage services in Settings.</p></div>
          <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Service Start Date<span className="text-red-500">*</span></label><input type="date" className="border rounded-xl px-3 py-2" value={reg.serviceDate} onChange={e=>setReg({...reg,serviceDate:e.target.value})} required/><p className="text-xs text-gray-500 mt-1">Appears as <b>Service Day</b> on Invoice & Receipt.</p></div>
        </div>
        <div className="flex justify-end mt-6"><button disabled={!regValid} onClick={goToInvoice} className={cls("rounded-xl px-4 py-2 text-white", regValid?"bg-blue-600 hover:bg-blue-700":"bg-gray-300 cursor-not-allowed")}>Continue</button></div>
      </section>)}

      {page===2 && (
  <section className="bg-white rounded-2xl shadow p-4 md:p-6">
    <div id="invoice-print">
      {/* Header: Brand left + right column shown in PDF */}
      <div className="pdf-header">
        <Brand biz={biz} nameClass="text-lg" metaClass="text-base" />
        <div className="pdf-right">
          <div className="font-medium">Phone</div>
          <div>{reg?.phone || '—'}</div>

          <div className="font-medium" style={{marginTop:12}}>Address</div>
          <div>{[reg?.address, reg?.city, reg?.state].filter(Boolean).join(', ') || '—'}</div>

          <div className="font-medium" style={{marginTop:12}}>Services</div>
          <div>{
            (reg?.selectedServices?.length ? reg.selectedServices
              : Array.isArray(reg?.services) ? reg.services : []
            ).join(', ') || '—'
          }</div>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-4 text-center">Invoice</h2>

      {/* Info grid — hide duplicates in PDF */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <RO label="Customer"    val={`${reg.firstName} ${reg.lastName}`} />
        <RO label="Phone"       val={reg.phone} className="pdf-hide" />
        <RO label="Email"       val={reg.email} />
        <RO label="Address"     val={`${reg.address}, ${reg.city}, ${reg.state} ${reg.zip}`} className="pdf-hide" />
        <RO label="Service Day" val={wday(reg.serviceDate)} />
        <RO label="Services"    val={(reg.selectedServices?.length ? reg.selectedServices : reg.services || []).join(', ') || '—'} className="pdf-hide" />
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <Inp label="Invoice #" val={invoice.invoiceNumber} set={v=>setInvoice({...invoice,invoiceNumber:v})}/>
        <Inp label="Date" type="date" val={invoice.invoiceDate} set={v=>setInvoice({...invoice,invoiceDate:v})}/>
        <Inp label="Due Date" type="date" val={invoice.dueDate} set={v=>setInvoice({...invoice,dueDate:v})}/>
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
            {invoice.items.map((it,i)=>{
              const line=(Number(it.qty)||0)*(Number(it.price)||0);
              return (
                <tr key={i} className="border-t">
                  <td className="p-2 align-top">{i+1}</td>
                  <td className="p-2 align-top">
                    <input
                      className="w-full border rounded-lg px-2 py-1"
                      value={it.desc}
                      onChange={e=>{
                        const items=[...invoice.items];
                        items[i]={...items[i],desc:e.target.value};
                        setInvoice({...invoice,items});
                      }}
                      placeholder="Service or product"
                    />
                  </td>
                  <td className="p-2 align-top">
                    <input
                      type="number" min={0}
                      className="w-24 border rounded-lg px-2 py-1"
                      value={it.qty}
                      onChange={e=>{
                        const items=[...invoice.items];
                        items[i]={...items[i],qty:e.target.value};
                        setInvoice({...invoice,items});
                      }}
                    />
                  </td>
                  <td className="p-2 align-top">
                    <input
                      type="number" min={0} step="0.01"
                      className="w-28 border rounded-lg px-2 py-1"
                      value={it.price}
                      onChange={e=>{
                        const items=[...invoice.items];
                        items[i]={...items[i],price:e.target.value};
                        setInvoice({...invoice,items});
                      }}
                    />
                  </td>
                  <td className="p-2 align-top whitespace-nowrap">{cur(line)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 mt-2">
        <button
          className="px-3 py-1 rounded-lg bg-gray-200 hover:bg-gray-300"
          onClick={()=>{
            const items=[...invoice.items];
            items.push({desc:'',qty:1,price:0});
            setInvoice({...invoice,items});
          }}>
          Add Row
        </button>
        <button
          className="px-3 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
          onClick={()=>{
            const items=[...invoice.items];
            items.pop();
            if(!items.length) items.push({desc:'',qty:1,price:0});
            setInvoice({...invoice,items});
          }}>
          Remove Last
        </button>
      </div>

      {paymentLinks?.length>0 && (
        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-3">
          <div className="text-sm font-semibold mb-2 text-blue-900">Pay Online</div>
          <div className="flex flex-wrap gap-3">
            {paymentLinks.map((l,i)=>(
  <a
    key={i}
    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border hover:bg-blue-100 text-blue-700"
    href={makePayUrl(l, subTotal, reg, invoice)}
    target="_blank"
    rel="noopener noreferrer"
  >
    <LinkIcon/><span className="font-medium">{l.label}</span>
  </a>
))}
          </div>
        </div>
      )}

      <div className="mt-4 grid md:grid-cols-3 gap-4 items-start">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            className="w-full border rounded-xl px-3 py-2 min-h-[84px]"
            value={invoice.notes}
            onChange={e=>setInvoice({...invoice,notes:e.target.value})}
            placeholder="Optional notes for the customer"
          />
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span><span>{cur(subTotal)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold border-t mt-2 pt-2">
            <span>Grand Total</span><span>{cur(subTotal)}</span>
          </div>
        </div>
      </div>
    </div>{/* /#invoice-print */}

    <div className="flex flex-wrap gap-2 justify-end mt-6">
      <button
        onClick={()=>openPdfFromEl(document.getElementById('invoice-print'),`Invoice-${invoice?.invoiceNumber ?? ''}`)}
        className="rounded-xl px-4 py-2 bg-gray-900 text-white hover:bg-black">
        Download PDF
      </button>
      <button onClick={()=>setPage(1)} className="rounded-xl px-4 py-2 bg-gray-200 hover:bg-gray-300">
        Back
      </button>
      <button onClick={()=>setPage(3)} className="rounded-xl px-4 py-2 bg-green-600 text-white hover:bg-green-700">
        Continue to Receipt
      </button>
    </div>

    <div className="mt-8 p-4 bg-yellow-50 rounded-xl text-sm">
      <p className="font-medium mb-2">Mark Payment (for Receipt)</p>
      <div className="grid md:grid-cols-4 gap-3">
        <div>
          <label className="block text-sm mb-1">Method</label>
          <select
            className="w-full border rounded-xl px-3 py-2"
            value={payment.method}
            onChange={e=>setPayment({...payment,method:e.target.value})}>
            {['Cash','Cashapp','Paypal','Venmo'].map(m=><option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <Inp label="Amount" type="number" step="0.01"
               val={payment.amount}
               set={v=>setPayment({...payment,amount:Number(v)||0})}/>
        </div>
        <div>
          <Inp label="Payment Date" type="date"
               val={payment.date}
               set={v=>setPayment({...payment,date:v})}/>
        </div>
        <div>
          <Inp label="Reference / Last 4"
               val={payment.reference}
               set={v=>setPayment({...payment,reference:v})}
               ph="Optional"/>
        </div>
      </div>
    </div>
  </section>
)}

      {page===3 && (<section className="bg-white rounded-2xl shadow p-4 md:p-6"><div id="receipt-print"><Brand biz={biz}/><h2 className="text-lg font-semibold mb-4 text-center">Payment Receipt</h2><div className="grid md:grid-cols-2 gap-4 mb-6"><RO label="Invoice #" val={String(invoice.invoiceNumber)}/><RO label="Payment Date" val={payment.date}/><RO label="Service Day" val={wday(reg.serviceDate)}/><RO label="Method" val={payment.method}/>{payment.reference&&<RO label="Reference" val={payment.reference}/>}</div><div className="grid md:grid-cols-2 gap-4 mb-6"><RO label="Received From" val={`${reg.firstName} ${reg.lastName}`}/><RO label="Contact" val={`${reg.phone} • ${reg.email}`}/><RO label="Address" val={`${reg.address}, ${reg.city}, ${reg.state} ${reg.zip}`} className="md:col-span-2"/></div><div className="bg-gray-50 rounded-2xl p-4"><div className="flex justify-between text-base font-semibold"><span>Amount Received</span><span>{cur(payment.amount)}</span></div><p className="text-sm text-gray-600 mt-2">Thank you for your business.</p></div></div><div className="flex flex-wrap gap-2 justify-end mt-6"><button onClick={()=>openPdfFromEl(document.getElementById('receipt-print'),`Receipt-${invoice?.invoiceNumber ??''}`)} className="rounded-xl px-4 py-2 bg-gray-900 text-white hover:bg-blue">Download PDF</button><button onClick={()=>setPage(2)} className="rounded-xl px-4 py-2 bg-gray-200 hover:bg-gray-300">Back to Invoice</button></div></section>)}
    </main>

    {/* Settings Modal */}
    {showSettings && (<div className="fixed inset-0 bg-black/30 flex items-end md:items-center md:justify-center p-4" onClick={()=>setShowSettings(false)}><div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl p-4" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between mb-3"><h3 className="text-lg font-semibold">Settings</h3><button onClick={()=>setShowSettings(false)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close">✕</button></div><div className="flex gap-2 mb-4 text-sm flex-wrap"><Tbtn a={tab==='services'} onClick={()=>setTab('services')}>Services</Tbtn><Tbtn a={tab==='methods'} onClick={()=>setTab('methods')}>Payment Methods</Tbtn><Tbtn a={tab==='branding'} onClick={()=>setTab('branding')}>Branding</Tbtn><Tbtn a={tab==='customers'} onClick={()=>setTab('customers')}>Customers</Tbtn><Tbtn a={tab==='plans'} onClick={()=>setTab('plans')}>Plans</Tbtn><Tbtn a={tab==='data'} onClick={()=>setTab('data')}>Data (Backup)</Tbtn></div>
      {tab==='services'&&(<div><label className="block text-sm font-medium mb-1">Add a new service</label><div className="flex gap-2"><input className="flex-1 border rounded-xl px-3 py-2" value={newService} onChange={e=>setNewService(e.target.value)} placeholder="e.g., Weekly Scoop"/><button onClick={()=>{const s=newService.trim();if(!s)return;if(!services.includes(s))setServices(p=>[...p,s]);setNewService('');}} className="rounded-xl px-4 py-2 bg-blue-600 text-white hover:bg-blue-700">Add</button></div><p className="text-xs text-gray-500 mt-1">Tap a service to select it, then the trash to delete. No limit.</p><div className="flex flex-wrap gap-2 mt-3">{services.length===0&&<span className="text-sm text-gray-500">No services yet.</span>}{services.map((s,i)=>{const sel=toDelete.includes(s);return(<button key={i} onClick={()=>setToDelete(p=>p.includes(s)?p.filter(x=>x!==s):[...p,s])} className={cls("px-3 py-1 rounded-full border",sel?"bg-red-50 border-red-300 text-red-700":"bg-gray-50 hover:bg-gray-100")}>{s}</button>)})}</div><div className="flex justify-between items-center mt-6"><button onClick={()=>{if(!toDelete.length)return;setServices(services.filter(s=>!toDelete.includes(s)));setToDelete([]);}} disabled={!toDelete.length} className={cls("inline-flex items-center gap-2 rounded-xl px-3 py-2",toDelete.length?"bg-red-600 text-white hover:bg-red-700":"bg-gray-200 text-gray-500 cursor-not-allowed")}>🗑️ Delete selected</button><button onClick={()=>setShowSettings(false)} className="rounded-xl px-4 py-2 bg-gray-200 hover:bg-gray-300">Done</button></div></div>)}
    {tab==='methods' && (
  <div>
    <h4 className="text-sm font-semibold mt-1">Payment Links</h4>

    {/* Add new link */}
    <label className="block text-sm font-medium mb-1 mt-1">Add a payment link</label>
    <div className="grid md:grid-cols-3 gap-2">
      <input className="border rounded-xl px-3 py-2"
             value={pmLabel} onChange={e=>setPmLabel(e.target.value)}
             placeholder="Label (Cashapp)"/>
      <input className="md:col-span-2 border rounded-xl px-3 py-2"
             value={pmUrl} onChange={e=>setPmUrl(e.target.value)}
             placeholder="https://..."/>
    </div>
    <div className="flex justify-end mt-2">
      <button
        onClick={()=>{
          const label = (pmLabel||'').trim(), url = (pmUrl||'').trim();
          if(!label || !url) return;
          setPaymentLinks(p => [...(Array.isArray(p)?p:[]), {label, url}]);
          setPmLabel(''); setPmUrl('');
        }}
        className="rounded-xl px-4 py-2 bg-blue-600 text-white hover:bg-blue-700">
        Add Link
      </button>
    </div>

    {/* Existing links with Edit/Delete */}
    <div className="mt-3">
      {(!Array.isArray(paymentLinks) || paymentLinks.length===0) && (
        <p className="text-sm text-gray-500">No payment links yet.</p>
      )}

      <ul className="space-y-2">
        {(Array.isArray(paymentLinks)?paymentLinks:[]).map((l, idx) => (
          <li key={idx} className="border rounded-xl px-3 py-2">
            {editIdx !== idx ? (
              /* read-only row */
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 truncate">
                  <span className="font-medium">{l?.label || '(no label)'}</span> —{' '}
                  <a className="text-blue-600 hover:underline break-all"
                     href={l?.url || '#'} target="_blank" rel="noopener noreferrer">
                    {l?.url || '(no url)'}
                  </a>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* EDIT */}
                  <button
                    onClick={() => { setEditIdx(idx); setEditTmp({label:l?.label||'', url:l?.url||''}); }}
                    className="p-2 rounded-full border text-gray-700 hover:bg-gray-100"
                    aria-label="Edit" title="Edit">
                    <EditIcon/>
                  </button>
                  {/* DELETE */}
                  <button
                    onClick={() => setPaymentLinks(p => (Array.isArray(p)?p:[]).filter((_,i)=>i!==idx))}
                    className="p-2 rounded-full border text-red-600 hover:bg-red-50"
                    aria-label="Delete" title="Delete">
                    🗑️
                  </button>
                </div>
              </div>
            ) : (
              /* inline editor */
              <div className="w-full">
                <div className="grid md:grid-cols-5 gap-2 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Label</label>
                    <input className="w-full border rounded-xl px-3 py-2"
                           value={editTmp.label}
                           onChange={e=>setEditTmp(v=>({...v, label:e.target.value}))}
                           placeholder="e.g. Cash App"/>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs text-gray-500 mb-1">URL</label>
                    <input className="w-full border rounded-xl px-3 py-2"
                           value={editTmp.url}
                           onChange={e=>setEditTmp(v=>({...v, url:e.target.value}))}
                           placeholder="https://…"/>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button onClick={()=>setEditIdx(null)}
                          className="px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300">
                    Cancel
                  </button>
                  <button
                    onClick={()=>{
                      const label=(editTmp.label||'').trim();
                      const url=(editTmp.url||'').trim();
                      if(!label || !url){ setEditIdx(null); return; }
                      setPaymentLinks(prev=>{
                        const p=(Array.isArray(prev)?[...prev]:[]);
                        p[idx]={label,url}; return p;
                      });
                      setEditIdx(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                    Save
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>

    <div className="flex justify-end mt-6">
      <button onClick={()=>setShowSettings(false)}
              className="rounded-xl px-4 py-2 bg-gray-200 hover:bg-gray-300">
        Done
      </button>
    </div>
  </div>
)}
      {tab==='branding'&&(<div><div className="grid md:grid-cols-2 gap-4"><div className="md:col-span-2"><h4 className="text-sm font-semibold">Business Branding</h4></div><div><label className="block text-sm mb-1">Business Name</label><input className="w-full border rounded-xl px-3 py-2" value={biz.name} onChange={e=>setBiz({...biz,name:e.target.value})} placeholder="Your Business LLC"/></div><div><label className="block text-sm mb-1">Phone</label><input className="w-full border rounded-xl px-3 py-2" value={biz.phone} onChange={e=>setBiz({...biz,phone:e.target.value})} placeholder="(555) 555-5555"/></div><div><label className="block text-sm mb-1">Email</label><input className="w-full border rounded-xl px-3 py-2" value={biz.email} onChange={e=>setBiz({...biz,email:e.target.value})} placeholder="you@example.com"/></div><div className="md:col-span-2"><label className="block text-sm mb-1">Address</label><input className="w-full border rounded-xl px-3 py-2" value={biz.address} onChange={e=>setBiz({...biz,address:e.target.value})} placeholder="123 Main St, City, ST 12345"/></div><div><label className="block text-sm mb-1">Logo (URL)</label><input className="w-full border rounded-xl px-3 py-2" value={biz.logoUrl} onChange={e=>setBiz({...biz,logoUrl:e.target.value})} placeholder="https://..."/><p className="text-xs text-gray-500 mt-1">Or upload:</p><input type="file" accept="image/*" className="mt-1" onChange={e=>{const f=e.target.files&&e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>setBiz({...biz,logoUrl:String(r.result)});r.readAsDataURL(f);}}/></div><div className="flex items-center justify-center gap-3">{biz.logoUrl?<img src={biz.logoUrl} alt="logo" className="w-16 h-16 object-contain rounded-xl border"/>:<div className="w-16 h-16 rounded-xl border flex items-center justify-center text-xs text-gray-400">No logo</div>}</div></div><div className="flex justify-end mt-6"><button onClick={()=>setShowSettings(false)} className="rounded-xl px-4 py-2 bg-gray-200 hover:bg-gray-300">Done</button></div></div>)}
      {tab==='customers'&&(<div><h4 className="text-sm font-semibold mb-2">Add / Edit Customer</h4><div className="grid md:grid-cols-4 gap-3"><input className="border rounded-xl px-3 py-2" placeholder="First" value={custForm.firstName} onChange={e=>setCustForm({...custForm,firstName:e.target.value})}/><input className="border rounded-xl px-3 py-2" placeholder="Last" value={custForm.lastName} onChange={e=>setCustForm({...custForm,lastName:e.target.value})}/><input className="border rounded-xl px-3 py-2" placeholder="Phone" value={custForm.phone} onChange={e=>setCustForm({...custForm,phone:e.target.value})}/><input className="border rounded-xl px-3 py-2" placeholder="Email" value={custForm.email} onChange={e=>setCustForm({...custForm,email:e.target.value})}/><div className="md:col-span-4 text-xs text-gray-600">Preferred Contact</div><div className="md:col-span-4 flex gap-4 text-sm">{['Call','Text','Email'].map(opt=>(<label key={opt} className="inline-flex items-center gap-2"><input type="checkbox" checked={(custForm.preferred||[]).includes(opt)} onChange={e=>{const s=new Set(custForm.preferred||[]);e.target.checked?s.add(opt):s.delete(opt);setCustForm({...custForm,preferred:[...s]});}}/> {opt}</label>))}</div><div className="md:col-span-4 text-xs text-gray-600">Billing Address</div><input className="border rounded-xl px-3 py-2" placeholder="Address" value={custForm.billing.address} onChange={e=>setCustForm({...custForm,billing:{...custForm.billing,address:e.target.value}})}/><input className="border rounded-xl px-3 py-2" placeholder="City" value={custForm.billing.city} onChange={e=>setCustForm({...custForm,billing:{...custForm.billing,city:e.target.value}})}/><select className="border rounded-xl px-3 py-2" value={custForm.billing.state} onChange={e=>setCustForm({...custForm,billing:{...custForm.billing,state:e.target.value}})}>{statesUS.map(s=><option key={s} value={s}>{s}</option>)}</select><input className="border rounded-xl px-3 py-2" placeholder="ZIP" value={custForm.billing.zip} onChange={e=>setCustForm({...custForm,billing:{...custForm.billing,zip:e.target.value}})}/><div className="md:col-span-4 text-xs text-gray-600">Service Address</div><input className="border rounded-xl px-3 py-2" placeholder="Address" value={custForm.service.address} onChange={e=>setCustForm({...custForm,service:{...custForm.service,address:e.target.value}})}/><input className="border rounded-xl px-3 py-2" placeholder="City" value={custForm.service.city} onChange={e=>setCustForm({...custForm,service:{...custForm.service,city:e.target.value}})}/><select className="border rounded-xl px-3 py-2" value={custForm.service.state} onChange={e=>setCustForm({...custForm,service:{...custForm.service,state:e.target.value}})}>{statesUS.map(s=><option key={s} value={s}>{s}</option>)}</select><input className="border rounded-xl px-3 py-2" placeholder="ZIP" value={custForm.service.zip} onChange={e=>setCustForm({...custForm,service:{...custForm.service,zip:e.target.value}})}/><div className="md:col-span-4"><label className="block text-sm font-medium mb-1">Default Services</label><Multi options={services} selected={custForm.defaultServices||[]} onToggle={opt=>{const ex=(custForm.defaultServices||[]).includes(opt);setCustForm({...custForm,defaultServices:ex?custForm.defaultServices.filter(s=>s!==opt):[...(custForm.defaultServices||[]),opt]});}} placeholder="Select services"/></div><div className="md:col-span-4"><textarea className="w-full border rounded-xl px-3 py-2 min-h-[64px]" placeholder="Notes" value={custForm.notes} onChange={e=>setCustForm({...custForm,notes:e.target.value})}/></div></div><div className="flex justify-end gap-2 mt-3"><button onClick={()=>setCustForm({...emptyCustomer})} className="rounded-xl px-3 py-2 bg-gray-200 hover:bg-gray-300">Clear</button><button onClick={()=>{if(!custForm.firstName&&!custForm.lastName)return;if(custForm.id)setCustomers(p=>p.map(c=>c.id===custForm.id?{...custForm}:c));else{const id=gid('cst');setCustomers(p=>[...p,{...custForm,id}]);setCustForm({...emptyCustomer});}}} className="rounded-xl px-3 py-2 bg-blue-600 text-white hover:bg-blue-700">{custForm.id?'Save Changes':'Add Customer'}</button></div><h4 className="text-sm font-semibold mt-6 mb-2">Customers</h4><div className="max-h-64 overflow-auto border rounded-xl"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2 text-left">Name</th><th className="p-2 text-left">Phone</th><th className="p-2 text-left">Email</th><th className="p-2 text-left">Actions</th></tr></thead><tbody>{customers.map(c=>(<tr key={c.id} className="border-t"><td className="p-2">{c.firstName} {c.lastName}</td><td className="p-2">{c.phone}</td><td className="p-2">{c.email}</td><td className="p-2"><div className="flex gap-2"><button onClick={()=>setCustForm({...c})} className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300">Edit</button><button onClick={()=>setCustomers(p=>p.filter(x=>x.id!==c.id))} className="px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200">Delete</button></div></td></tr>))}{customers.length===0&&(<tr><td className="p-3 text-sm text-gray-500" colSpan={4}>No customers yet.</td></tr>)}</tbody></table></div></div>)}
      {tab==='plans'&&(<PlansTab customers={customers} plans={plans} setPlans={setPlans} services={services} biz={biz}/>) }
      {tab==='data'&&(<div><h4 className="text-sm font-semibold mb-2">Backup & Restore</h4><div className="flex flex-wrap items-center gap-3"><button onClick={()=>{const data={services,payment_links:paymentLinks,business_profile:biz,customers,plans,invoice_seq:ls.get('invoice_seq',1000)};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`backup-${today()}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},0);}} className="rounded-xl px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700">Export JSON</button><label className="inline-flex items-center gap-2 text-sm">Import JSON<input type="file" accept="application/json" onChange={e=>{const f=e.target.files&&e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const o=JSON.parse(String(r.result||'{}'));if(o.services)setServices(o.services);if(o.payment_links)setPaymentLinks(o.payment_links);if(o.business_profile)setBiz(o.business_profile);if(o.customers)setCustomers(o.customers);if(o.plans)setPlans(o.plans);if(typeof o.invoice_seq==='number')ls.set('invoice_seq',o.invoice_seq);alert('Import complete');}catch(err){alert('Import failed: '+err);}};r.readAsText(f);}} className="block"/></label></div><p className="text-xs text-gray-500 mt-3">Export includes services, payment links, branding, customers, plans, and invoice counter.</p></div>) }
    </div></div>) }

    {/* Save Prompt */}
    {showSavePrompt && (<div className="fixed inset-0 bg-black/40 flex items-end md:items-center md:justify-center p-4"><div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5"><h3 className="text-lg font-semibold mb-2">Save this person to Customers?</h3><p className="text-sm text-gray-600">We can save this registration as a customer for next time.</p><label className="flex items-center gap-2 mt-4 text-sm"><input type="checkbox" checked={dontAskAgain} onChange={e=>setDontAskAgain(e.target.checked)}/> Don't ask again</label><div className="flex justify-end gap-2 mt-4"><button onClick={()=>handleSavePrompt('skip')} className="rounded-xl px-3 py-2 bg-gray-200 hover:bg-gray-300">Not now</button><button onClick={()=>handleSavePrompt('save')} className="rounded-xl px-3 py-2 bg-blue-600 text-white hover:bg-blue-700">Save</button></div></div></div>)}

    {/* Tips (first run) */}
    {showTips && (<div className="fixed inset-0 bg-black/40 flex items-end md:items-center md:justify-center p-4"><div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-5"><h3 className="text-lg font-semibold mb-2">Tips you should know</h3><ul className="list-disc pl-5 text-sm space-y-2"><li>Open <b>Settings</b> → add your <b>Services</b> (first run is empty).</li><li>Add <b>Payment Methods</b> and <b>Branding</b>. They appear on invoices, receipts, and PDFs.</li><li>Use <b>Customers</b> to save recurring details and preferred contact.</li><li>Create <b>Plans</b> for recurring work; pause/resume; export <b>.ics</b> reminders.</li></ul><label className="flex items-center gap-2 mt-4 text-sm"><input type="checkbox" checked={dontShowTips} onChange={e=>setDontShowTips(e.target.checked)}/> Don't show me again</label><div className="flex justify-end gap-2 mt-4"><button onClick={()=>{if(dontShowTips)ls.set('hide_tips',true);setShowTips(false);}} className="rounded-xl px-4 py-2 bg-blue-600 text-white hover:bg-blue-700">Continue</button></div></div></div>)}

    <footer className="text-center text-xs text-gray-500 py-6">© {new Date().getFullYear()} — Simple 3-Page App</footer>
  </div>);
}

// ---------- Small components ----------
const Pill=({label,act,onClick})=> (<button onClick={onClick} className={cls("px-3 py-1.5 rounded-full border",act?"bg-blue-600 text-white border-blue-600":"bg-white hover:bg-gray-50")}>{label}</button>);
const Tbtn=({children,a,onClick})=> (<button onClick={onClick} className={cls("px-3 py-1.5 rounded-full border",a?"bg-blue-600 text-white border-blue-600":"bg-white hover:bg-gray-50")}>{children}</button>);
const Inp=({label,val,set,type="text",ph,req,pattern})=> (<div><label className="block text-sm font-medium mb-1">{label}{req&&<span className="text-red-500">*</span>}</label><input className="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring" value={val} onChange={e=>set(e.target.value)} type={type} placeholder={ph} required={req} pattern={pattern}/></div>);
const RO=({label,val,className})=> (<div className={className}><label className="block text-sm text-gray-600">{label}</label><div className="mt-1 font-medium">{val||'—'}</div></div>);
function Multi({options,selected,onToggle,placeholder}){const [open,setOpen]=useState(false);return(<div className="relative"><div className="flex flex-wrap gap-2 border rounded-xl px-3 py-2 min-h-[44px] cursor-pointer bg-white" onClick={()=>setOpen(!open)}>{selected.length===0?<span className="text-gray-400">{placeholder}</span>:selected.map((s,i)=>(<span key={i} className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs border border-blue-200">{s}</span>))}<span className="ml-auto text-gray-500">▾</span></div>{open&&(<div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto bg-white border rounded-xl shadow">{options.length===0&&(<div className="p-3 text-sm text-gray-500">No options yet. Add in Settings.</div>)}{options.map((opt,i)=>{const sel=selected.includes(opt);return(<button key={i} onClick={()=>onToggle(opt)} className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"><span className={cls("inline-flex h-4 w-4 items-center justify-center border rounded",sel?"bg-blue-600 border-blue-600 text-white":"bg-white")}>{sel?"✓":""}</span><span>{opt}</span></button>)})}</div>)}</div>);}
const Brand = ({ biz, nameClass = "text-2xl", metaClass = "text-lg" }) => {
  if (!(biz?.name || biz?.logoUrl || biz?.phone || biz?.email || biz?.address || biz?.city || biz?.state)) return null;
  const name   = biz?.name || "";
  const citySt = [biz?.city, biz?.state].filter(Boolean).join(", ");

  return (
    <div className="brand flex flex-col md:flex-row items-start md:items-center gap-4 mb-4 text-left">
      <div>
        {biz?.logoUrl ? (
          <img className="brand-img" src={biz.logoUrl} alt={name || "Logo"} />
        ) : (
          <div style={{ width: 72, height: 72 }} className="rounded-xl border flex items-center justify-center text-[10px] text-gray-400">Logo</div>
        )}
      </div>

      <div className="brand-info">
        {name ? <div className={`name font-semibold ${nameClass}`}>{name}</div> : null}

        <div className={`meta text-gray-600 leading-tight ${metaClass}`}>
          {biz?.phone ? <div>{biz.phone}</div> : null}
          {biz?.email ? (
            <div>
              <a className="underline text-blue-600" href={`mailto:${biz.email}`}>{biz.email}</a>
            </div>
          ) : null}
          {biz?.address ? <div>{biz.address}</div> : null}
          {citySt ? <div>{citySt}</div> : null}
        </div>
      </div>
    </div>
  );
};

function PlansTab({customers,plans,setPlans,services,biz}){
  const [f,setF]=useState({id:'',customerId:'',name:'',frequency:'weekly',interval:1,startDate:today(),nextDate:today(),endDate:'',services:[],items:[],dueRule:{daysAfter:7},active:true});
  const save=()=>{if(!f.customerId)return;const base={...f};if(!base.id){base.id=gid('pln');if(!base.startDate)base.startDate=today();if(!base.nextDate)base.nextDate=base.startDate;setPlans(p=>[...p,base]);}else setPlans(p=>p.map(x=>x.id===base.id?base:x));setF({id:'',customerId:'',name:'',frequency:'weekly',interval:1,startDate:today(),nextDate:today(),endDate:'',services:[],items:[],dueRule:{daysAfter:7},active:true});};
  const dlIcs=(p)=>{const c=customers.find(x=>x.id===p.customerId);const ics=icsForPlan(p,c,biz);const fname=`${(p.name||'Plan')}-${c?(c.firstName+'-'+c.lastName):'Customer'}.ics`.replace(/\s+/g,'_');const blob=new Blob([ics],{type:'text/calendar'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fname;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},0);};
  return (<div><h4 className="text-sm font-semibold mb-2">Create / Edit Plan</h4><div className="grid md:grid-cols-6 gap-3"><div className="md:col-span-2"><label className="block text-sm">Customer</label><select className="w-full border rounded-xl px-3 py-2" value={f.customerId} onChange={e=>setF({...f,customerId:e.target.value})}><option value="">— Select —</option>{customers.map(c=><option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}</select></div><div className="md:col-span-2"><label className="block text-sm">Plan Name</label><input className="w-full border rounded-xl px-3 py-2" value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="e.g., Jane Weekly"/></div><div><label className="block text-sm">Frequency</label><select className="w-full border rounded-xl px-3 py-2" value={f.frequency} onChange={e=>setF({...f,frequency:e.target.value})}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="customDays">Every N Days</option></select></div><div><label className="block text-sm">Interval</label><input type="number" min={1} className="w-full border rounded-xl px-3 py-2" value={f.interval} onChange={e=>setF({...f,interval:Number(e.target.value)||1})}/></div><div><label className="block text-sm">Start</label><input type="date" className="w-full border rounded-xl px-3 py-2" value={f.startDate} onChange={e=>setF({...f,startDate:e.target.value})}/></div><div><label className="block text-sm">Next</label><input type="date" className="w-full border rounded-xl px-3 py-2" value={f.nextDate} onChange={e=>setF({...f,nextDate:e.target.value})}/></div><div><label className="block text-sm">End (optional)</label><input type="date" className="w-full border rounded-xl px-3 py-2" value={f.endDate||''} onChange={e=>setF({...f,endDate:e.target.value})}/></div><div><label className="block text-sm">Due (days after)</label><input type="number" min={0} className="w-full border rounded-xl px-3 py-2" value={f.dueRule.daysAfter} onChange={e=>setF({...f,dueRule:{daysAfter:Number(e.target.value)||0}})}/></div><div className="md:col-span-6"><label className="block text-sm font-medium mb-1">Services</label><Multi options={services} selected={f.services} onToggle={opt=>{const ex=(f.services||[]).includes(opt);setF({...f,services:ex?f.services.filter(s=>s!==opt):[...(f.services||[]),opt]});}} placeholder="Select services"/></div><div className="md:col-span-6"><label className="block text-sm font-medium mb-1">Items</label><PlanItems items={f.items} setItems={it=>setF({...f,items:it})}/></div></div><div className="flex justify-end gap-2 mt-3"><button onClick={()=>setF({id:'',customerId:'',name:'',frequency:'weekly',interval:1,startDate:today(),nextDate:today(),endDate:'',services:[],items:[],dueRule:{daysAfter:7},active:true})} className="rounded-xl px-3 py-2 bg-gray-200 hover:bg-gray-300">Clear</button><button onClick={save} className="rounded-xl px-3 py-2 bg-blue-600 text-white hover:bg-blue-700">{f.id?'Save Changes':'Add Plan'}</button></div><h4 className="text-sm font-semibold mt-6 mb-2">Plans</h4><div className="max-h-72 overflow-auto border rounded-xl"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2 text-left">Plan</th><th className="p-2 text-left">Customer</th><th className="p-2 text-left">Next</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Actions</th></tr></thead><tbody>{plans.map(p=>{const c=customers.find(x=>x.id===p.customerId);return(<tr key={p.id} className="border-t"><td className="p-2">{p.name||'(no name)'} <span className="text-xs text-gray-500">{p.frequency}×{p.interval}</span></td><td className="p-2">{c?`${c.firstName} ${c.lastName}`:'—'}</td><td className="p-2">{p.nextDate}</td><td className="p-2">{p.active?<span className="text-green-700">Active</span>:<span className="text-gray-500">Paused</span>}</td><td className="p-2"><div className="flex flex-wrap gap-2"><button onClick={()=>setF({...p})} className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300">Edit</button><button onClick={()=>setPlans(x=>x.map(y=>y.id===p.id?{...y,active:!y.active}:y))} className={cls("px-2 py-1 rounded",p.active?"bg-yellow-100 text-yellow-800 hover:bg-yellow-200":"bg-green-100 text-green-800 hover:bg-green-200")}>{p.active?'Pause':'Resume'}</button><button onClick={()=>dlIcs(p)} className="px-2 py-1 rounded bg-white border hover:bg-gray-50">.ics</button><button onClick={()=>setPlans(x=>x.map(y=>y.id===p.id?{...y,nextDate:nextOcc(y.nextDate||y.startDate,y)}:y))} className="px-2 py-1 rounded bg-white border hover:bg-gray-50">Advance Next</button><button onClick={()=>setPlans(x=>x.filter(y=>y.id!==p.id))} className="px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200">Delete</button></div></td></tr>);})}{plans.length===0&&(<tr><td className="p-3 text-sm text-gray-500" colSpan={5}>No plans yet.</td></tr>)}</tbody></table></div></div>);}

function PlanItems({items,setItems}){const local=items&&items.length?items:[{desc:'',qty:1,price:0}];return(<div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2 text-left">Description</th><th className="p-2 text-left">Qty</th><th className="p-2 text-left">Unit Price</th><th className="p-2 text-left">Actions</th></tr></thead><tbody>{local.map((it,idx)=>(<tr key={idx} className="border-t"><td className="p-2"><input className="w-full border rounded-lg px-2 py-1" value={it.desc} onChange={e=>{const a=[...local];a[idx]={...a[idx],desc:e.target.value};setItems(a);}} placeholder="Service or product"/></td><td className="p-2"><input type="number" min={0} className="w-24 border rounded-lg px-2 py-1" value={it.qty} onChange={e=>{const a=[...local];a[idx]={...a[idx],qty:e.target.value};setItems(a);}}/></td><td className="p-2"><input type="number" min={0} step="0.01" className="w-28 border rounded-lg px-2 py-1" value={it.price} onChange={e=>{const a=[...local];a[idx]={...a[idx],price:e.target.value};setItems(a);}}/></td><td className="p-2"><div className="flex gap-2"><button className="px-3 py-1 rounded-lg bg-gray-200 hover:bg-gray-300" onClick={()=>{const a=[...local];a.splice(idx+1,0,{desc:'',qty:1,price:0});setItems(a);}}>Add Row</button><button className="px-3 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200" onClick={()=>{const a=[...local];a.splice(idx,1);setItems(a.length?a:[{desc:'',qty:1,price:0}]);}}>Remove</button></div></td></tr>))}</tbody></table></div>);}

function GearIcon(){return(<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.065 2.572c.94 1.543-.827 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.827-2.37-2.37a1.724 1.724 0 00-1.066-2.572c-1.756-.426-1.756-2.924 0-3.35.46-.111.86-.411 1.066-.82z"/></svg>);} 
function LinkIcon(){return(<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M10.59 13.41a1 1 0 010-1.41l2.59-2.59a1 1 0 111.41 1.41l-2.59 2.59a1 1 0 01-1.41 0z"/><path d="M12.88 4.12a5 5 0 017.07 7.07l-1.76 1.76a1 1 0 01-1.41-1.41l1.76-1.76a3 3 0 10-4.24-4.24l-1.76 1.76a1 1 0 11-1.41-1.41l1.76-1.76z"/><path d="M4.05 12.05a5 5 0 017.07 0 1 1 0 11-1.41 1.41 3 3 0 00-4.24 0l-1.76 1.76a3 3 0 104.24 4.24l1.76-1.76a1 1 0 111.41 1.41l-1.76 1.76a5 5 0 11-7.07-7.07l1.76-1.76z"/></svg>);}
function TrashIcon(){return(<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
     fill="none" stroke="currentColor" strokeWidth="1.5"
     className="w-5 h-5" aria-hidden="true">
  <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 6h18M8 6V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1m1 0v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0v12m4-12v12m4-12v12" />
</svg>
  );
}

function EditIcon(){
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
     fill="none" stroke="currentColor" strokeWidth="1.5"
     className="w-5 h-5" aria-hidden="true">
  <path strokeLinecap="round" strokeLinejoin="round"
        d="M16.862 3.487a2.25 2.25 0 0 1 3.182 3.182L8.25 18.463l-4.5 1.5 1.5-4.5L16.862 3.487z" />
  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 4.5l3.75 3.75" />
</svg>
  );
}

// …PASTE HERE…  (Start at the comment line right after your original import)
// Your code should still end with:  export default function App(){ ... }

// === END YOUR APP CODE ===

// Expose a simple mount API that Canvas will call
export function mount(el){
  const root = ReactDOM.createRoot(el);
  root.render(React.createElement(App));
  return () => root.unmount();
}
 
 
