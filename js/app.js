'use strict';
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const KEY = 'scsp-data';
  const uid = () => Math.random().toString(36).slice(2, 10);
  const MAX = 12;

  /* ---------- State ---------- */
  const fresh = () => ({ className: '', rows: 5, cols: 6, seats: Array(30).fill(null), off: Array(30).fill(false), students: [], layouts: [] });
  let S;
  try {
    S = { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    if (S.seats.length !== S.rows * S.cols || S.off.length !== S.rows * S.cols) S = fresh();
  } catch (e) { S = fresh(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } };
  const toast = msg => { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.append(t); setTimeout(() => t.remove(), 3200); };
  const byId = id => S.students.find(s => s.id === id);
  const seatedIds = () => new Set(S.seats.filter(Boolean));
  const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const availSeats = () => S.seats.map((_, i) => i).filter(i => !S.off[i]);
  const clampInt = (v, lo, hi, d) => { v = parseInt(v, 10); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };

  /* ---------- Theme ---------- */
  $('#themeBtn').onclick = () => {
    const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('scsp-theme', t); } catch (e) { }
  };

  /* ---------- Moving students ---------- */
  let picked = null; // {type:'seat', i} | {type:'stu', id}
  function move(src, target) {
    // target: {type:'seat', i} | {type:'pool'}
    if (target.type === 'seat' && S.off[target.i]) return toast('That seat is unavailable.');
    const id = src.type === 'seat' ? S.seats[src.i] : src.id;
    if (!id) return;
    if (target.type === 'pool') {
      if (src.type === 'seat') S.seats[src.i] = null;
    } else {
      const displaced = S.seats[target.i];
      if (src.type === 'seat') { if (src.i === target.i) return; S.seats[src.i] = displaced; }
      S.seats[target.i] = id;
    }
    save(); render();
  }
  const parseDrag = str => {
    const [k, v] = String(str).split(':');
    return k === 'seat' ? { type: 'seat', i: +v } : k === 'stu' ? { type: 'stu', id: v } : null;
  };

  /* ---------- Rendering ---------- */
  const GC = i => `var(--g${i % 8})`;
  function render() {
    const { rows, cols } = S;
    $('#className').value !== S.className && ($('#className').value = S.className);
    $('#rows').value = rows; $('#cols').value = cols;
    $('#boardTitle').textContent = S.className || 'Seating Chart';
    $('#boardSub').textContent = `${rows} rows × ${cols} seats · ${new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}`;

    const board = $('#board');
    board.style.setProperty('--cols', cols);
    board.replaceChildren();
    const groups = new Set();
    S.seats.forEach((id, i) => {
      const el = document.createElement('div');
      el.className = 'seat'; el.dataset.i = i; el.setAttribute('role', 'gridcell');
      const no = document.createElement('span'); no.className = 'no'; no.textContent = i + 1; el.append(no);
      if (S.off[i]) { el.classList.add('off'); el.setAttribute('aria-label', `Seat ${i + 1} unavailable`); }
      else if (id && byId(id)) {
        const st = byId(id);
        el.classList.add('filled'); el.draggable = true; el.tabIndex = 0;
        el.append(document.createTextNode(st.name));
        if (st.group != null) { el.style.setProperty('--gc', GC(st.group)); groups.add(st.group); }
        if (S.showLevel) { const l = document.createElement('span'); l.className = 'lvl'; l.textContent = st.level; el.append(l); }
      } else { el.classList.add('empty'); el.setAttribute('aria-label', `Seat ${i + 1} empty`); }
      if (picked && picked.type === 'seat' && picked.i === i) el.classList.add('picked');
      board.append(el);
    });

    const pool = $('#pool'); pool.replaceChildren();
    const seated = seatedIds();
    const un = S.students.filter(s => !seated.has(s.id));
    un.forEach(s => {
      const chip = document.createElement('span');
      chip.className = 'stu'; chip.draggable = true; chip.dataset.id = s.id;
      if (picked && picked.type === 'stu' && picked.id === s.id) chip.classList.add('picked');
      chip.append(document.createTextNode(s.name));
      const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.dataset.del = s.id; x.setAttribute('aria-label', `Remove ${s.name}`);
      chip.append(x); pool.append(chip);
    });
    if (!un.length) { const p = document.createElement('span'); p.className = 'hint'; p.textContent = S.students.length ? 'Everyone has a seat 🎉' : 'Add students to get started.'; pool.append(p); }

    const avail = availSeats().length, filled = seated.size, empty = avail - S.seats.filter((id, i) => id && !S.off[i]).length;
    $('#studentCount').textContent = `${S.students.length} total`;
    $('#stats').innerHTML = [['Seats', avail], ['Students', S.students.length], ['Seated', filled], ['Empty seats', empty, empty > 0 && S.students.length ? 'warn' : ''], ['Unseated', un.length, un.length ? 'warn' : '']]
      .map(([l, v, c]) => `<div class="stat ${c || ''}"><b>${v}</b><span class="muted">${l}</span></div>`).join('');
    $('#legend').innerHTML = [...groups].sort((a, b) => a - b).map(g => `<span><i style="--gc:${GC(g)}"></i>Group ${g + 1}</span>`).join('');

    const sel = $('#layoutSel');
    sel.innerHTML = S.layouts.length ? S.layouts.map((l, i) => `<option value="${i}"></option>`).join('') : '<option value="">No saved layouts</option>';
    [...sel.options].forEach((o, i) => { if (S.layouts[i]) o.textContent = S.layouts[i].name; });
  }

  /* ---------- Board interactions ---------- */
  const board = $('#board'), pool = $('#pool');
  board.addEventListener('dragstart', e => { const s = e.target.closest('.seat.filled'); if (!s) return; e.dataTransfer.setData('text/plain', 'seat:' + s.dataset.i); e.dataTransfer.effectAllowed = 'move'; });
  pool.addEventListener('dragstart', e => { const c = e.target.closest('.stu'); if (!c) return; e.dataTransfer.setData('text/plain', 'stu:' + c.dataset.id); e.dataTransfer.effectAllowed = 'move'; });
  board.addEventListener('dragover', e => { const s = e.target.closest('.seat'); if (s && !s.classList.contains('off')) { e.preventDefault(); s.classList.add('over'); } });
  board.addEventListener('dragleave', e => e.target.closest('.seat')?.classList.remove('over'));
  board.addEventListener('drop', e => {
    e.preventDefault();
    const s = e.target.closest('.seat'); if (!s) return;
    const src = parseDrag(e.dataTransfer.getData('text/plain')); picked = null;
    if (src) move(src, { type: 'seat', i: +s.dataset.i }); else render();
  });
  document.addEventListener('dragend', () => document.querySelectorAll('.over').forEach(x => x.classList.remove('over')));
  pool.addEventListener('dragover', e => { e.preventDefault(); pool.classList.add('over'); });
  pool.addEventListener('dragleave', () => pool.classList.remove('over'));
  pool.addEventListener('drop', e => {
    e.preventDefault(); pool.classList.remove('over');
    const src = parseDrag(e.dataTransfer.getData('text/plain')); picked = null;
    if (src && src.type === 'seat') move(src, { type: 'pool' }); else render();
  });

  // Click / tap-to-move (works on touch and keyboard)
  function seatClick(el) {
    const i = +el.dataset.i;
    if (picked) {
      const p = picked; picked = null;
      if (p.type === 'seat' && p.i === i) return render();
      return move(p, { type: 'seat', i });
    }
    if (el.classList.contains('filled')) { picked = { type: 'seat', i }; render(); }
  }
  board.addEventListener('click', e => { const s = e.target.closest('.seat'); if (s) seatClick(s); });
  board.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.seat')) { e.preventDefault(); seatClick(e.target); } });
  board.addEventListener('dblclick', e => {
    const s = e.target.closest('.seat'); if (!s) return;
    const i = +s.dataset.i; picked = null;
    if (S.seats[i]) return;
    S.off[i] = !S.off[i]; save(); render();
  });
  pool.addEventListener('click', e => {
    const del = e.target.closest('[data-del]');
    if (del) { const id = del.dataset.del; S.students = S.students.filter(s => s.id !== id); picked = null; save(); return render(); }
    const chip = e.target.closest('.stu');
    if (chip) { picked = picked && picked.type === 'stu' && picked.id === chip.dataset.id ? null : { type: 'stu', id: chip.dataset.id }; return render(); }
    if (picked && picked.type === 'seat') { const p = picked; picked = null; move(p, { type: 'pool' }); }
  });

  /* ---------- Setup ---------- */
  $('#className').oninput = e => { S.className = e.target.value.slice(0, 50); save(); $('#boardTitle').textContent = S.className || 'Seating Chart'; };
  $('#applySize').onclick = () => {
    const rows = clampInt($('#rows').value, 1, MAX, S.rows), cols = clampInt($('#cols').value, 1, MAX, S.cols);
    const seats = Array(rows * cols).fill(null), off = Array(rows * cols).fill(false);
    let lost = 0;
    S.seats.forEach((id, i) => {
      const r = Math.floor(i / S.cols), c = i % S.cols;
      if (r < rows && c < cols) { seats[r * cols + c] = id; off[r * cols + c] = S.off[i]; } else if (id) lost++;
    });
    Object.assign(S, { rows, cols, seats, off }); picked = null; save(); render();
    toast(lost ? `Resized. ${lost} student${lost > 1 ? 's were' : ' was'} moved to unseated.` : 'Classroom resized.');
  };

  /* ---------- Students ---------- */
  const addStudents = (names, level = 'M') => {
    const have = new Set(S.students.map(s => s.name.toLowerCase()));
    let n = 0;
    names.map(x => x.trim().slice(0, 40)).filter(Boolean).forEach(name => {
      if (have.has(name.toLowerCase())) return;
      have.add(name.toLowerCase()); S.students.push({ id: uid(), name, level, group: null }); n++;
    });
    save(); render(); return n;
  };
  $('#addForm').onsubmit = e => {
    e.preventDefault();
    const n = addStudents([$('#stuName').value], $('#stuLevel').value);
    if (!n) toast('That student is already in the list.');
    e.target.reset(); $('#stuName').focus();
  };
  $('#bulkBtn').onclick = () => {
    const n = addStudents($('#bulk').value.split(/[\n,;]+/));
    $('#bulk').value = ''; toast(n ? `Added ${n} student${n > 1 ? 's' : ''}.` : 'No new names to add.');
  };
  const SAMPLE = ['Amara Okafor', 'Liam Chen', 'Sofia Rossi', 'Noah Kim', 'Zainab Bello', 'Ethan Brown', 'Mia Novak', 'Lucas Silva', 'Aisha Khan', 'Oliver Smith', 'Emma Davis', 'Daniel Mensah', 'Chloe Martin', 'Ravi Patel', 'Grace Mwansa', 'Jack Wilson', 'Hana Sato', 'Samuel Banda', 'Ivy Thompson', 'Omar Hassan', 'Lily Garcia', 'Tendai Moyo'];
  $('#sampleBtn').onclick = () => {
    const lv = ['H', 'M', 'L'];
    const n = addStudents(SAMPLE);
    S.students.forEach((s, i) => { if (SAMPLE.includes(s.name)) s.level = lv[i % 3]; });
    if (!S.className) S.className = 'Sample Class';
    save(); render(); toast(n ? 'Sample class loaded.' : 'Sample students are already added.');
  };

  /* ---------- Strategies ---------- */
  function place(order, slots, groupSize) {
    S.seats = Array(S.rows * S.cols).fill(null);
    S.students.forEach(s => { s.group = null; });
    order.slice(0, slots.length).forEach((s, k) => { S.seats[slots[k]] = s.id; if (groupSize) s.group = Math.floor(k / groupSize); });
    return Math.max(0, order.length - slots.length);
  }
  // Seats ordered by 2×2 pods so that group members sit together
  function podOrder() {
    const out = [];
    for (let pr = 0; pr < S.rows; pr += 2) for (let pc = 0; pc < S.cols; pc += 2)
      for (let r = pr; r < Math.min(pr + 2, S.rows); r++) for (let c = pc; c < Math.min(pc + 2, S.cols); c++) { const i = r * S.cols + c; if (!S.off[i]) out.push(i); }
    return out;
  }
  function balancedOrder() {
    const lv = { H: shuffle(S.students.filter(s => s.level === 'H')), M: shuffle(S.students.filter(s => s.level === 'M')), L: shuffle(S.students.filter(s => s.level === 'L')) };
    const out = [];
    while (lv.H.length || lv.M.length || lv.L.length) for (const k of ['H', 'M', 'L']) if (lv[k].length) out.push(lv[k].shift());
    return out;
  }
  document.querySelector('.strat').addEventListener('click', e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    if (!S.students.length) return toast('Add some students first.');
    if (!availSeats().length) return toast('No seats are available.');
    picked = null;
    const avail = availSeats(); let over = 0, msg;
    switch (b.dataset.s) {
      case 'random': over = place(shuffle(S.students), avail); msg = 'Students shuffled randomly.'; break;
      case 'alpha': over = place([...S.students].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })), avail); msg = 'Seated alphabetically.'; break;
      case 'group': over = place(shuffle(S.students), podOrder(), clampInt($('#groupSize').value, 2, 8, 4)); msg = 'Group seating applied.'; break;
      case 'balanced': {
        const hasLevels = new Set(S.students.map(s => s.level)).size > 1;
        over = place(balancedOrder(), avail);
        msg = hasLevels ? 'Levels balanced across rows.' : 'Balanced (all students share one level — set levels when adding).';
        break;
      }
    }
    save(); render(); toast(over ? `${msg} ${over} student${over > 1 ? 's' : ''} didn't fit.` : msg);
  });
  $('#clearSeats').onclick = () => { S.seats.fill(null); S.students.forEach(s => { s.group = null; }); picked = null; save(); render(); };

  /* ---------- Saved layouts ---------- */
  $('#saveLayout').onclick = () => {
    const name = $('#layoutName').value.trim() || `Layout ${S.layouts.length + 1}`;
    const snap = { name, rows: S.rows, cols: S.cols, seats: [...S.seats], off: [...S.off], students: S.students.map(s => ({ ...s })), className: S.className };
    const i = S.layouts.findIndex(l => l.name === name);
    if (i >= 0) S.layouts[i] = snap; else S.layouts.push(snap);
    $('#layoutName').value = ''; save(); render(); toast(`Saved “${name}”.`);
  };
  $('#loadLayout').onclick = () => {
    const l = S.layouts[+$('#layoutSel').value]; if (!l) return;
    Object.assign(S, { rows: l.rows, cols: l.cols, seats: [...l.seats], off: [...l.off], students: l.students.map(s => ({ ...s })), className: l.className }); picked = null;
    save(); render(); toast(`Loaded “${l.name}”.`);
  };
  $('#delLayout').onclick = () => {
    const i = +$('#layoutSel').value; if (!S.layouts[i]) return;
    S.layouts.splice(i, 1); save(); render();
  };

  /* ---------- Print ---------- */
  $('#printBtn').onclick = () => {
    if (!S.students.length) toast('Add students before printing for a useful chart.');
    picked = null; render(); window.print();
  };

  render();
})();
