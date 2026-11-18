/** Contenu géré par l'admin (textes, coordonnées, APK) et inscription des entreprises de livraison */

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://api.leto.performx.online';

interface Landing {
  faq: { q: string; a: string }[];
  contact: { phone: string; email: string; whatsapp: string; address: string };
  apk: { url: string | null; version: string; sizeMb: number | null; updatedAt: string | null };
  [k: string]: unknown;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Valeur à un chemin « a.b.0.c » */
function at(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj);
}

export async function applyContent() {
  let c: Landing;
  try {
    const res = await fetch(`${API_URL}/landing`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return;
    c = (await res.json()) as Landing;
  } catch {
    return; // la page garde ses textes par défaut
  }
  // Textes
  document.querySelectorAll<HTMLElement>('[data-cms]').forEach((el) => {
    const v = at(c, el.dataset.cms!);
    if (typeof v === 'string' && v.trim()) el.textContent = v;
  });
  // Questions fréquentes
  const list = document.getElementById('faq-list');
  if (list && Array.isArray(c.faq) && c.faq.length) {
    list.innerHTML = c.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('');
  }
  // Coordonnées
  const line = document.getElementById('contact-line');
  if (line) {
    const parts: string[] = [];
    if (c.contact.phone) parts.push(`<a href="tel:${esc(c.contact.phone.replace(/\s/g, ''))}">${esc(c.contact.phone)}</a>`);
    if (c.contact.whatsapp) parts.push(`<a href="https://wa.me/${esc(c.contact.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener">WhatsApp ${esc(c.contact.whatsapp)}</a>`);
    if (c.contact.email) parts.push(`<a href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a>`);
    if (c.contact.address) parts.push(esc(c.contact.address));
    if (parts.length) line.innerHTML = parts.join(' · ');
  }
  // Application Android : « Télécharger l'app » télécharge l'APK
  if (c.apk?.url) {
    const href = c.apk.url.startsWith('http') ? c.apk.url : `${API_URL}${c.apk.url}`;
    document.querySelectorAll<HTMLAnchorElement>('a[data-apk]').forEach((a) => {
      a.href = href;
      a.setAttribute('download', 'LETO.apk');
      a.rel = 'noopener';
    });
    const meta = [`Android · APK${c.apk.version ? ` v${c.apk.version}` : ''}`, c.apk.sizeMb ? `${String(c.apk.sizeMb).replace('.', ',')} Mo` : ''].filter(Boolean).join(' · ');
    document.querySelectorAll<HTMLElement>('[data-apk-meta]').forEach((el) => (el.textContent = meta));
  }
}

const COMMUNES = ['Abobo', 'Adjamé', 'Anyama', 'Attécoubé', 'Bingerville', 'Cocody', 'Koumassi', 'Marcory', 'Plateau', 'Port-Bouët', 'Songon', 'Treichville', 'Yopougon', 'Hors d’Abidjan'];
const phone = (v: string) => {
  let d = v.replace(/\D/g, '');
  if (d.startsWith('225') && d.length === 13) d = d.slice(3);
  return d;
};

/** Formulaire « Devenir entreprise partenaire » → demande validée par LETO */
export function setupApply() {
  const dlg = document.getElementById('apply') as HTMLDialogElement | null;
  const form = document.getElementById('apply-form') as HTMLFormElement | null;
  if (!dlg || !form) return;
  const err = document.getElementById('apply-error')!;
  const done = document.getElementById('apply-done')!;
  const submit = document.getElementById('apply-submit') as HTMLButtonElement;
  const commune = document.getElementById('ap-commune') as HTMLSelectElement;
  commune.innerHTML = COMMUNES.map((c) => `<option>${c}</option>`).join('');

  const open = () => {
    form.hidden = false;
    done.hidden = true;
    err.hidden = true;
    dlg.showModal();
    (document.getElementById('ap-name') as HTMLInputElement).focus();
  };
  document.querySelectorAll('[data-apply]').forEach((b) => b.addEventListener('click', open));
  dlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dlg.close()));
  dlg.addEventListener('click', (e) => e.target === dlg && dlg.close());
  if (location.hash === '#partenaire') open();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const f = new FormData(form);
    const body = {
      name: String(f.get('name') ?? '').trim(),
      phone: phone(String(f.get('phone') ?? '')),
      commune: String(f.get('commune') ?? ''),
      drivers: f.get('drivers') ? Number(f.get('drivers')) : undefined,
      vehicles: f.getAll('vehicles').map(String),
      managerName: String(f.get('managerName') ?? '').trim(),
      managerPhone: phone(String(f.get('managerPhone') ?? '')),
      managerPassword: String(f.get('managerPassword') ?? ''),
      message: String(f.get('message') ?? '').trim() || undefined,
    };
    const fail = (m: string) => {
      err.textContent = m;
      err.hidden = false;
    };
    if (!body.name || !body.managerName) return fail('Indiquez le nom de l’entreprise et celui du gérant.');
    if (!/^0\d{9}$/.test(body.phone) || !/^0\d{9}$/.test(body.managerPhone)) return fail('Les numéros doivent avoir 10 chiffres, ex. 07 01 02 03 04.');
    if (body.managerPassword.length < 6) return fail('Le mot de passe doit faire au moins 6 caractères.');
    if (!body.vehicles.length) return fail('Cochez au moins un engin.');
    submit.disabled = true;
    submit.textContent = 'Envoi…';
    try {
      const res = await fetch(`${API_URL}/companies/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message[0] : data.message || 'Envoi impossible, réessayez.');
      form.reset();
      form.hidden = true;
      done.hidden = false;
    } catch (e2) {
      fail((e2 as Error).message);
    } finally {
      submit.disabled = false;
      submit.textContent = 'Envoyer ma demande';
    }
  });
}
