// Up Next: Starting Point checklist and address, from Ken's container prototype.
// Every tick is saved to Caspio (lib/upNext.js). In dev, ?up_next_preview shows
// the page without a member and saves nothing.
import { useEffect, useState } from 'react';
import { getStoredGuid } from '../lib/auth.js';
import { UP_NEXT, addressLookupOn, emptyState, loadLabDates, loadUpNext, lookupAddress, retrieveAddress, saveMailingAddress, saveUpNext } from '../lib/upNext.js';
import './UpNextPage.css';

const POSTAL_RE = /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/;
const fmtPostal = (v) => {
  const s = (v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return s.length > 3 ? `${s.slice(0, 3)} ${s.slice(3)}` : s;
};
const blankAddr = () => ({ postalCode: '', line1: '', unit: '', city: '', province: '' });
const today = () => new Date().toISOString().slice(0, 10);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDay = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${MONTHS[m - 1]} ${d}`; };
const daysFromToday = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date();
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5);
};
const dueText = (n) => (n === 0 ? 'due today' : n > 0 ? `in ${n} ${n === 1 ? 'day' : 'days'}` : `${-n} ${n === -1 ? 'day' : 'days'} past due`);

// `labs` undefined: still loading or failed, so nothing shows. null: none on file.
function LabBar({ labs, onNavigate }) {
  if (labs === undefined) return null;
  const late = labs && daysFromToday(labs.next) < 0;
  return (
    <div className="un-nudge" role="status">
      {labs ? (
        <>
          <span>Last labs <b>{fmtDay(labs.last)}</b></span>
          <span className={late ? 'late' : ''}>Next labs <b>{fmtDay(labs.next)}</b> ({dueText(daysFromToday(labs.next))})</span>
        </>
      ) : <span>No labs on file.</span>}
      <button type="button" className="un-link" onClick={() => onNavigate?.('vault')}><span>Add to <em>My</em>Vault</span></button>
    </div>
  );
}

function Check({ done, onChange, label, small }) {
  return (
    <button type="button" role="checkbox" aria-checked={!!done} aria-label={label}
      className={`un-ck${small ? ' sm' : ''}${done ? ' on' : ''}`} onClick={onChange}>
      {done ? '✓' : ''}
    </button>
  );
}

function LinkOrNote({ url, children, onOpen }) {
  const [note, setNote] = useState(false);
  if (url) return <a className="un-link" href={url} target="_blank" rel="noopener noreferrer" onClick={onOpen}>{children}</a>;
  return (
    <span>
      <button type="button" className="un-link" onClick={() => setNote(true)}>{children}</button>
      {note && <span className="un-note" role="status"> This link is not set yet.</span>}
    </span>
  );
}

function AddressFields({ id, label, value, onChange, errs }) {
  const [list, setList] = useState([]);
  const [asked, setAsked] = useState('');
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  // The lookup only helps: if it's off or fails, the fields are typed by hand.
  const find = (term, lastId) => lookupAddress(term, lastId).then(setList).catch(() => setList([]));
  function postal(e) {
    const v = fmtPostal(e.target.value);
    onChange({ ...value, postalCode: v });
    if (!addressLookupOn) return;
    if (POSTAL_RE.test(v) && v !== asked) { setAsked(v); find(v, ''); }
    if (!POSTAL_RE.test(v)) { setList([]); setAsked(''); }
  }
  async function pick(it) {
    if (it.next === 'Find') { find(value.postalCode, it.id); return; }
    const a = await retrieveAddress(it.id).catch(() => ({}));
    setList([]);
    onChange({ ...value, line1: a.line1 || it.text, city: a.city || value.city, province: a.province || value.province, postalCode: a.postalCode ? fmtPostal(a.postalCode) : value.postalCode });
  }
  const input = (k, placeholder, props = {}) => (
    <>
      <input id={`${id}-${k}`} type="text" aria-label={`${label} ${placeholder}`} placeholder={placeholder}
        aria-invalid={!!errs[k]} value={value[k]} onChange={set(k)} {...props} />
      {errs[k] && <p className="un-err" role="alert">{errs[k]}</p>}
    </>
  );
  return (
    <fieldset>
      <legend>{label}</legend>
      {input('postalCode', 'Postal code', { autoComplete: 'postal-code', maxLength: 7, onChange: postal })}
      {list.length > 0 && (
        <ul className="un-sugg" aria-label="Address suggestions">
          {list.map((it) => <li key={it.id}><button type="button" onClick={() => pick(it)}><b>{it.text}</b><span>{it.description}</span></button></li>)}
        </ul>
      )}
      {input('line1', 'Street number and name', { autoComplete: 'address-line1' })}
      {input('unit', 'Unit (optional)', { autoComplete: 'address-line2' })}
      {input('city', 'City', { autoComplete: 'address-level2' })}
      {input('province', 'Province', { autoComplete: 'address-level1', maxLength: 2,
        onChange: (e) => onChange({ ...value, province: e.target.value.toUpperCase() }) })}
    </fieldset>
  );
}

function checkAddr(a) {
  const e = {};
  if (!POSTAL_RE.test(a.postalCode)) e.postalCode = 'Enter a postal code, such as L7R 1A1.';
  if (!a.line1.trim()) e.line1 = 'Enter the street number and name.';
  if (!a.city.trim()) e.city = 'Enter the city.';
  if (a.province.trim().length !== 2) e.province = 'Enter the 2-letter province.';
  return e;
}
const cleanAddr = (a) => ({ postalCode: fmtPostal(a.postalCode), line1: a.line1.trim(), unit: a.unit.trim(), city: a.city.trim(), province: a.province.trim() });

function AddressForm({ address, onSave, onCancel }) {
  const [home, setHome] = useState(address?.home || blankAddr());
  const [ship, setShip] = useState(address?.shipTo || blankAddr());
  const [same, setSame] = useState(!address?.shipTo);
  const [eh, setEh] = useState({});
  const [es, setEs] = useState({});
  function submit(e) {
    e.preventDefault();
    const h = checkAddr(home);
    const s = same ? {} : checkAddr(ship);
    setEh(h);
    setEs(s);
    if (Object.keys(h).length || Object.keys(s).length) return;
    onSave({ home: cleanAddr(home), shipTo: same ? null : cleanAddr(ship) });
  }
  return (
    <form className="un-addr" onSubmit={submit} noValidate>
      <AddressFields id="home" label="Home address" value={home} onChange={(v) => { setHome(v); setEh({}); }} errs={eh} />
      <label className="un-same"><input type="checkbox" checked={same} onChange={(e) => setSame(e.target.checked)} /> Ship to: same as home</label>
      {!same && <AddressFields id="ship" label="Ship to" value={ship} onChange={(v) => { setShip(v); setEs({}); }} errs={es} />}
      <div className="un-acts">
        <button type="submit" className="un-btn">Save</button>
        <button type="button" className="un-link" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function Task({ t, st, onToggle, onSub, onPlan, descOverride, doneOverride, children }) {
  const [showInfo, setShowInfo] = useState(false);
  const done = doneOverride ?? !!st.tasks[t.id];
  const text = done && t.repeat ? `Returns in ${t.repeat}.` : (descOverride ?? t.desc);
  const prep = (t.subs || []).filter((s) => s.type !== 'plan');
  const plan = (t.subs || []).find((s) => s.type === 'plan');
  const planKey = plan && `${t.id}.${plan.id}`;
  const planVal = plan ? (st.plans[planKey] || { mode: null, date: '' }) : null;
  const dateMode = plan?.dateMode || 'booked';
  return (
    <div className={`un-task${done ? ' done' : ''}`}>
      <Check done={done} label={t.title} onChange={() => onToggle(t.id)} />
      <div className="un-tb">
        <div className="un-tt">
          <b>{t.title}</b>
          {t.info && <button type="button" className="un-info" aria-expanded={showInfo} aria-label={`About ${t.title}`} onClick={() => setShowInfo(!showInfo)}>i</button>}
        </div>
        {showInfo && t.info && <p className="un-note" role="note">{t.info}</p>}
        {text && <p>{text}</p>}
        {!done && prep.length > 0 && (
          <ul className="un-subs">
            {prep.map((s) => {
              const sd = !!st.subs[`${t.id}.${s.id}`];
              return (
                <li key={s.id} className={sd ? 'done' : ''}>
                  <Check small done={sd} label={s.title} onChange={() => onSub(t.id, s.id)} />
                  <span>{s.title}</span>
                  {s.link && !sd && <LinkOrNote url={s.link.url} onOpen={() => onSub(t.id, s.id, true)}>{s.link.label}</LinkOrNote>}
                </li>
              );
            })}
          </ul>
        )}
        {!done && plan && (
          <div className="un-plan" role="group" aria-label={plan.title}>
            {plan.checkable && <Check small done={!!st.subs[planKey]} label={`${plan.title} done`} onChange={() => onSub(t.id, plan.id)} />}
            <span className={`un-pl${st.subs[planKey] ? ' dn' : ''}`}>{plan.title}</span>
            {(plan.opts || [['booked', 'Booked'], ['walk-in', 'Walk-in']]).map(([v, label]) => (
              <button key={v} type="button" className="un-chip" aria-pressed={planVal.mode === v}
                onClick={() => onPlan(planKey, v === dateMode ? { ...planVal, mode: v } : { mode: v, date: '' })}>{label}</button>
            ))}
            {planVal.mode === dateMode && (
              <input type="date" className="un-dt" aria-label={`${plan.title} date`} min={plan.opts ? undefined : today()}
                value={planVal.date || ''} onChange={(e) => onPlan(planKey, { ...planVal, date: e.target.value })} />
            )}
          </div>
        )}
        {!done && t.link && <div className="un-acts"><LinkOrNote url={t.link.url}>{t.link.label}</LinkOrNote></div>}
        {!done && t.links && <div className="un-acts">{t.links.map((l) => <LinkOrNote key={l.label} url={l.url}>{l.label}</LinkOrNote>)}</div>}
        {children}
      </div>
    </div>
  );
}

function Group({ g, st, renderTask }) {
  const [open, setOpen] = useState(true);
  const d = g.items.filter((i) => st.tasks[i.id]).length;
  const all = d === g.items.length;
  useEffect(() => { if (all) setOpen(false); }, [all]);
  const ordered = [...g.items.filter((i) => !st.tasks[i.id]), ...g.items.filter((i) => st.tasks[i.id])];
  return (
    <div className={`un-grp${all ? ' done' : ''}`}>
      <button type="button" className="un-grp-h" aria-expanded={open} aria-controls={`un-${g.id}`} onClick={() => setOpen(!open)}>
        <span className="un-gt"><b>{g.title}</b><span>{g.desc}</span></span>
        <span className="un-gr"><span className="un-pill">{d} of {g.items.length}</span><span className="un-chev" aria-hidden="true">{open ? '▴' : '▾'}</span></span>
      </button>
      {open && <div className="un-kids" id={`un-${g.id}`}>{ordered.map((t) => <div key={t.id}>{renderTask(t)}</div>)}</div>}
    </div>
  );
}

export default function UpNextPage({ onNavigate }) {
  const member = getStoredGuid();
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('up_next_preview');
  const [st, setSt] = useState(preview ? emptyState() : null);
  const [loadErr, setLoadErr] = useState(false);
  const [saveErr, setSaveErr] = useState(false);
  const [addrOpen, setAddrOpen] = useState(false);
  const [labs, setLabs] = useState(preview ? null : undefined);

  useEffect(() => {
    if (preview) return undefined;
    if (!member) { setLoadErr(true); return undefined; }
    let live = true;
    loadUpNext(member)
      .then((s) => { if (live) setSt(s); })
      .catch(() => { if (live) setLoadErr(true); });
    loadLabDates(member)
      .then((l) => { if (live) setLabs(l); })
      .catch(() => { /* no bar is the safe failure */ });
    return () => { live = false; };
  }, [member, preview]);

  function commit(next) {
    setSt(next);
    setSaveErr(false);
    if (!preview) saveUpNext(member, next).catch(() => setSaveErr(true));
  }

  const stamp = (doneAt, id, done) => ({ ...doneAt, [id]: done ? new Date().toISOString() : undefined });

  const toggle = (id) => commit({ ...st, tasks: { ...st.tasks, [id]: !st.tasks[id] }, doneAt: stamp(st.doneAt, id, !st.tasks[id]) });

  function sub(taskId, subId, forceDone) {
    const key = `${taskId}.${subId}`;
    const subs = { ...st.subs, [key]: forceDone ? true : !st.subs[key] };
    // A task with tickable steps is done when they all are.
    const task = UP_NEXT.flatMap((g) => g.items || []).find((t) => t.id === taskId);
    const need = (task?.subs || []).filter((s) => s.type !== 'plan' || s.checkable);
    const tasks = need.length
      ? { ...st.tasks, [taskId]: need.every((s) => subs[`${taskId}.${s.id}`]) }
      : st.tasks;
    commit({ ...st, subs, tasks, doneAt: tasks[taskId] === st.tasks[taskId] ? st.doneAt : stamp(st.doneAt, taskId, tasks[taskId]) });
  }

  const plan = (key, val) => commit({ ...st, plans: { ...st.plans, [key]: val } });

  function saveAddress(address) {
    setAddrOpen(false);
    commit({ ...st, address });
    if (!preview) saveMailingAddress(member, address.home).catch((e) => console.warn('Address copy failed:', e));
  }

  if (loadErr) return <div className="un-page"><h1>Up Next</h1><p className="un-err" role="alert">We couldn't load your list. Please refresh the page.</p></div>;
  if (!st) return <div className="un-page"><h1>Up Next</h1><p className="un-note" role="status">Loading…</p></div>;

  const a = st.address;
  const renderTask = (t) => {
    const handlers = { st, onToggle: toggle, onSub: sub, onPlan: plan };
    if (t.form !== 'address') return <Task t={t} {...handlers} />;
    const desc = a
      ? `${a.home.line1}, ${a.home.city}${a.shipTo ? `. Ship to: ${a.shipTo.line1}, ${a.shipTo.city}.` : '.'}`
      : t.desc;
    return (
      <Task t={t} {...handlers} onToggle={() => setAddrOpen(true)} doneOverride={!!a} descOverride={desc}>
        {!addrOpen && <div className="un-acts"><button type="button" className="un-link" onClick={() => setAddrOpen(true)}>{a ? 'Change' : 'Add address'}</button></div>}
        {addrOpen && <AddressForm address={a} onSave={saveAddress} onCancel={() => setAddrOpen(false)} />}
      </Task>
    );
  };
  const isDone = (g) => (g.items ? g.items.every((i) => st.tasks[i.id]) : g.form === 'address' ? !!a : !!st.tasks[g.id]);
  const ordered = [...UP_NEXT.filter((g) => !isDone(g)), ...UP_NEXT.filter(isDone)];
  const allDone = UP_NEXT.every(isDone);

  return (
    <div className="un-page">
      <LabBar labs={labs} onNavigate={onNavigate} />
      <div className="un-head">
        <h1>Up Next</h1>
        <p className="un-lead">Nudges, tasks and appointments, in order: blood pressure readings, the end of cycle review, labs, consultations and blood draws.</p>
      </div>
      {saveErr && <p className="un-err" role="alert">That last change didn't save. Please try again.</p>}
      {allDone && (
        <div className="un-complete" role="status">
          <h2>You&rsquo;re all set.</h2>
          <p>Nothing is waiting.</p>
          <button type="button" className="un-btn" onClick={() => onNavigate?.('strategy')}>Go to <em>My</em>Strategy</button>
        </div>
      )}
      {ordered.map((g) => (g.items
        ? <Group key={g.id} g={g} st={st} renderTask={renderTask} />
        : <div key={g.id}>{renderTask(g)}</div>))}
    </div>
  );
}
