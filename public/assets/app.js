const state = {
  token: localStorage.getItem("crmToken") || "",
  user: null,
  fields: [],
  schools: [],
  users: [],
  campaigns: [],
  reminders: [],
  filterOptions: {},
  mapData: { states: [], districts: [], selected_state: "" },
  mapGeo: null,
  selectedState: "",
  activity: { events: [], summary: {} },
  reports: null,
  tab: "database",
  authMode: "login",
  selectedSchool: null,
  history: [],
  filters: { search: "", disposition: "", campaign: "" },
  advancedFilters: [],
};

const dispositions = [
  "Not Called",
  "Connected",
  "Interested",
  "Call Back",
  "Not Interested",
  "Wrong Number",
  "No Response",
  "Registered",
];

const app = document.getElementById("app");

async function api(path, options = {}) {
  const headers = options.headers || {};
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function roleLabel() {
  return state.user?.role === "admin" ? "Admin dashboard" : "Outreach dashboard";
}

function render() {
  if (!state.user) return renderLogin();
  app.innerHTML = `
    <header class="topbar">
      <div>
        <strong>School Outreach CRM</strong>
        <div class="muted">${roleLabel()} · ${escapeHtml(state.user.name)}</div>
      </div>
      <button class="btn secondary" onclick="logout()">Log out</button>
    </header>
    <section class="shell">
      <aside class="side">
        <nav class="nav">
          ${navButton("database", "Database")}
          ${state.user.role === "admin" ? navButton("map", "India Map") : ""}
          ${navButton("calling", "Calling")}
          ${navButton("campaigns", "Campaigns")}
          ${navButton("reminders", "Reminders")}
          ${state.user.role === "admin" ? navButton("activity", "Team Activity") : ""}
          ${state.user.role === "admin" ? navButton("reports", "Reports") : ""}
          ${state.user.role === "admin" ? navButton("upload", "Bulk Upload") : ""}
        </nav>
      </aside>
      <section class="content">${screen()}</section>
    </section>
    ${drawer()}
  `;
}

function navButton(tab, label) {
  return `<button class="${state.tab === tab ? "active" : ""}" onclick="setTab('${tab}')">${label}</button>`;
}

function setTab(tab) {
  state.tab = tab;
  if (tab === "reports") loadReports();
  if (tab === "reminders") loadReminders();
  if (tab === "campaigns") loadCampaigns();
  if (tab === "map") loadMap();
  if (tab === "activity") loadActivity();
  render();
}

function renderLogin(error = "") {
  const signup = state.authMode === "signup";
  app.innerHTML = `
    <section class="login">
      <form class="login-panel" onsubmit="${signup ? "signup(event)" : "login(event)"}">
        <h1 class="brand">School Outreach CRM</h1>
        <p class="muted">${signup ? "Create your account. Admin accounts need the secret code only during signup." : "Sign in with email and password to manage school records, calls, campaigns, reminders, and registrations."}</p>
        ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
        ${signup ? `
        <div class="field">
          <label>Name</label>
          <input name="name" autocomplete="name" required />
        </div>
        <div class="field">
          <label>Role</label>
          <select name="role" onchange="toggleAdminSecret(this.value)">
            <option value="outreach">Outreach</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div class="field hidden" id="adminSecretField">
          <label>Admin secret code</label>
          <input name="admin_secret" placeholder="Required for admin signup" />
        </div>` : ""}
        <div class="field">
          <label>Email</label>
          <input name="email" type="email" value="${signup ? "" : "admin@schoolcrm.local"}" autocomplete="username" required />
        </div>
        <div class="field">
          <label>Password</label>
          <input name="password" type="password" value="${signup ? "" : "admin123"}" autocomplete="${signup ? "new-password" : "current-password"}" required />
        </div>
        <div class="row" style="margin-top:18px">
          <button class="btn" type="submit">${signup ? "Create account" : "Sign in"}</button>
          <button class="btn secondary" type="button" onclick="switchAuth('${signup ? "login" : "signup"}')">${signup ? "I already have an account" : "Create account"}</button>
        </div>
        ${signup ? `<p class="muted">Local admin secret: XM-ADMIN-2026. Change this with the ADMIN_SECRET environment variable before deployment.</p>` : `<p class="muted">Demo admin: admin@schoolcrm.local / admin123</p>`}
      </form>
      <div class="login-visual"></div>
    </section>
  `;
}

function switchAuth(mode) {
  state.authMode = mode;
  renderLogin();
}

function toggleAdminSecret(role) {
  document.getElementById("adminSecretField")?.classList.toggle("hidden", role !== "admin");
}

async function login(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem("crmToken", data.token);
    await bootstrap();
  } catch (err) {
    renderLogin(err.message);
  }
}

async function signup(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  try {
    const data = await api("/api/signup", {
      method: "POST",
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        role: form.get("role"),
        admin_secret: form.get("admin_secret"),
      }),
    });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem("crmToken", data.token);
    await bootstrap();
  } catch (err) {
    renderLogin(err.message);
  }
}

function logout() {
  localStorage.removeItem("crmToken");
  Object.assign(state, { token: "", user: null, schools: [], selectedSchool: null });
  render();
}

function screen() {
  if (state.tab === "map") return mapScreen();
  if (state.tab === "calling") return callingScreen();
  if (state.tab === "campaigns") return campaignsScreen();
  if (state.tab === "reminders") return remindersScreen();
  if (state.tab === "activity") return activityScreen();
  if (state.tab === "reports") return reportsScreen();
  if (state.tab === "upload") return uploadScreen();
  return databaseScreen();
}

function databaseScreen() {
  return `
    ${toolbar()}
    <section class="panel">
      <div class="panel-head">
        <div>
          <strong>${state.schools.length} schools</strong>
          <div class="muted">Inline edits are saved with cell-level history.</div>
        </div>
        <button class="btn secondary" onclick="downloadCsv()">Export CSV</button>
      </div>
      <div class="table-wrap">${schoolTable()}</div>
    </section>
  `;
}

function toolbar() {
  return `
    <div class="toolbar">
      <div class="field">
        <label>Search</label>
        <input value="${escapeHtml(state.filters.search)}" oninput="filterChange('search', this.value)" placeholder="School, city, phone, email..." />
      </div>
      <div class="field">
        <label>Disposition</label>
        <select onchange="filterChange('disposition', this.value)">
          <option value="">All</option>
          ${dispositions.map((d) => `<option ${state.filters.disposition === d ? "selected" : ""}>${d}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>Campaign</label>
        <select onchange="filterChange('campaign', this.value)">
          <option value="">All</option>
          ${state.campaigns.map((c) => `<option value="${c.id}" ${String(state.filters.campaign) === String(c.id) ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>Show</label>
        <select onchange="quickFilter(this.value)">
          <option value="">All schools</option>
          <option value="Call Back">Call backs</option>
          <option value="Registered">Registered</option>
        </select>
      </div>
      <button class="btn" onclick="loadSchools()">Refresh</button>
    </div>
    <section class="panel filter-panel">
      <div class="panel-head">
        <div>
          <strong>Field filters</strong>
          <div class="muted">Filter by any imported field to create datasets for campaigns and task assignment.</div>
        </div>
        <button class="btn secondary" onclick="addFieldFilter()">Add filter</button>
      </div>
      <div class="panel-body stack">
        ${state.advancedFilters.map((filter, index) => fieldFilterRow(filter, index)).join("") || `<div class="muted">No field filters added yet.</div>`}
      </div>
    </section>
  `;
}

function fieldFilterRow(filter, index) {
  const values = state.filterOptions[filter.field] || [];
  return `
    <div class="filter-row">
      <select onchange="updateFieldFilter(${index}, 'field', this.value)">
        ${state.fields.map((f) => `<option value="${escapeHtml(f)}" ${filter.field === f ? "selected" : ""}>${escapeHtml(f)}</option>`).join("")}
      </select>
      <input list="options-${index}" value="${escapeHtml(filter.value)}" oninput="updateFieldFilter(${index}, 'value', this.value)" placeholder="Contains..." />
      <datalist id="options-${index}">
        ${values.map((v) => `<option value="${escapeHtml(v)}"></option>`).join("")}
      </datalist>
      <button class="btn icon secondary" onclick="removeFieldFilter(${index})" title="Remove filter">×</button>
    </div>
  `;
}

function addFieldFilter(field = state.fields[0], value = "") {
  state.advancedFilters.push({ field, value });
  render();
}

function updateFieldFilter(index, key, value) {
  state.advancedFilters[index][key] = value;
  clearTimeout(filterTimer);
  filterTimer = setTimeout(loadSchools, 250);
}

function removeFieldFilter(index) {
  state.advancedFilters.splice(index, 1);
  loadSchools();
}

let filterTimer;
function filterChange(key, value) {
  state.filters[key] = value;
  clearTimeout(filterTimer);
  filterTimer = setTimeout(loadSchools, 250);
}

function quickFilter(value) {
  state.filters.disposition = value;
  loadSchools();
}

function schoolTable(limitFields = state.fields) {
  if (!state.schools.length) return `<div class="empty">No schools match the current filters.</div>`;
  const cols = limitFields;
  return `
    <table>
      <thead>
        <tr>
          <th class="sticky-col">School</th>
          <th>Disposition</th>
          <th>Assigned</th>
          <th>Registered</th>
          ${cols.slice(2).map((f) => `<th>${escapeHtml(f)}</th>`).join("")}
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${state.schools.map((s) => rowHtml(s, cols)).join("")}
      </tbody>
    </table>
  `;
}

function rowHtml(s, cols) {
  const assignee = state.users.find((u) => u.id === s.assigned_to)?.name || "";
  return `
    <tr>
      <td class="sticky-col">
        <strong contenteditable="true" onblur="saveCell(${s.id}, 'SCHOOL NAME', this.innerText)">${escapeHtml(s["SCHOOL NAME"])}</strong>
        <div class="muted">${escapeHtml(s["SCHOOL CODE"])}</div>
      </td>
      <td>${dispositionSelect(s)}</td>
      <td>${assigneeSelect(s)}</td>
      <td><input type="checkbox" ${s.registered_event ? "checked" : ""} onchange="saveCell(${s.id}, 'registered_event', this.checked ? 1 : 0)" /></td>
      ${cols.slice(2).map((f) => `<td contenteditable="true" onblur="saveCell(${s.id}, '${escapeAttr(f)}', this.innerText)">${escapeHtml(s[f])}</td>`).join("")}
      <td>
        <button class="btn secondary" onclick="openSchool(${s.id})">Open</button>
      </td>
    </tr>
  `;
}

function escapeAttr(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

function dispositionSelect(s) {
  return `
    <select onchange="logCall(${s.id}, this.value, ${s.current_campaign_id || "null"})">
      ${dispositions.map((d) => `<option ${s.disposition === d ? "selected" : ""}>${d}</option>`).join("")}
    </select>
  `;
}

function assigneeSelect(s) {
  if (state.user.role !== "admin") return `<span class="muted">${escapeHtml(state.users.find((u) => u.id === s.assigned_to)?.name || "")}</span>`;
  return `
    <select onchange="saveCell(${s.id}, 'assigned_to', this.value)">
      <option value="">Unassigned</option>
      ${state.users.filter((u) => u.role === "outreach").map((u) => `<option value="${u.id}" ${s.assigned_to === u.id ? "selected" : ""}>${escapeHtml(u.name)}</option>`).join("")}
    </select>
  `;
}

async function saveCell(id, field, value) {
  const data = await api(`/api/schools/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ field, value }),
  });
  const index = state.schools.findIndex((s) => s.id === id);
  if (index >= 0) state.schools[index] = data.school;
  if (state.selectedSchool?.id === id) state.selectedSchool = data.school;
}

async function logCall(schoolId, disposition, campaignId) {
  const note = prompt("Call note", "");
  await api("/api/calls", {
    method: "POST",
    body: JSON.stringify({ school_id: schoolId, campaign_id: campaignId, disposition, note: note || "" }),
  });
  await loadSchools();
}

async function openSchool(id) {
  state.selectedSchool = state.schools.find((s) => s.id === id);
  state.history = [];
  render();
  await loadHistory(id);
}

async function loadHistory(id, field = "") {
  const suffix = field ? `?field=${encodeURIComponent(field)}` : "";
  const data = await api(`/api/schools/${id}/history${suffix}`);
  state.history = data.history;
  render();
}

function drawer() {
  const s = state.selectedSchool;
  return `
    <aside class="drawer ${s ? "open" : ""}">
      ${s ? `
      <div class="panel-head">
        <div>
          <strong>${escapeHtml(s["SCHOOL NAME"])}</strong>
          <div class="muted">${escapeHtml(s["SCHOOL CODE"])}</div>
        </div>
        <button class="btn icon secondary" onclick="state.selectedSchool=null;render()" title="Close">×</button>
      </div>
      <div class="drawer-content stack">
        <div class="row">
          <span class="badge ${s.registered_event ? "good" : ""}">${s.registered_event ? "Registered" : "Not registered"}</span>
          <span class="badge warn">${escapeHtml(s.disposition)}</span>
        </div>
        <div class="field">
          <label>Event name</label>
          <input value="${escapeHtml(s.event_name || "")}" onblur="saveCell(${s.id}, 'event_name', this.value)" />
        </div>
        <div class="field">
          <label>Set reminder</label>
          <input type="datetime-local" id="reminderDue" />
          <textarea id="reminderNote" placeholder="Follow-up note"></textarea>
          <button class="btn" onclick="createReminder(${s.id})">Set reminder</button>
        </div>
        <div class="field">
          <label>Cell history</label>
          <select onchange="loadHistory(${s.id}, this.value)">
            <option value="">All fields</option>
            ${state.fields.map((f) => `<option>${escapeHtml(f)}</option>`).join("")}
          </select>
        </div>
        ${historyHtml()}
      </div>` : ""}
    </aside>
  `;
}

function historyHtml() {
  if (!state.history.length) return `<div class="empty">No edits recorded yet.</div>`;
  return state.history.map((h) => `
    <div class="history-item">
      <strong>${escapeHtml(h.field)}</strong>
      <div class="muted">${escapeHtml(h.user_name || "System")} · ${new Date(h.changed_at).toLocaleString()}</div>
      <div>From: ${escapeHtml(h.old_value || "blank")}</div>
      <div>To: ${escapeHtml(h.new_value || "blank")}</div>
    </div>
  `).join("");
}

async function createReminder(schoolId) {
  const due = document.getElementById("reminderDue").value;
  const note = document.getElementById("reminderNote").value;
  if (!due) return alert("Choose a reminder date and time.");
  await api("/api/reminders", { method: "POST", body: JSON.stringify({ school_id: schoolId, due_at: due, note }) });
  await loadReminders();
  alert("Reminder saved.");
}

function callingScreen() {
  const fields = ["SCHOOL CODE", "SCHOOL NAME", "SCHOOL MOBILE NO", "SCHOOL PHONE NO.", "PRINCIPAL NAME", "PRINCIPAL MOBILE NO.", "SPoC/COORDINATOR NAME", "SPoC MOBILE NO", "SCHOOL EMAIL ID"];
  return `
    ${toolbar()}
    <section class="panel">
      <div class="panel-head">
        <div>
          <strong>Calling list</strong>
          <div class="muted">Update dispositions as calls happen; each disposition creates a call log.</div>
        </div>
      </div>
      <div class="table-wrap">${schoolTable(fields)}</div>
    </section>
  `;
}

function campaignsScreen() {
  return `
    <div class="split">
      <section class="panel">
        <div class="panel-head">
          <div>
            <strong>Campaigns</strong>
            <div class="muted">Create a list from the currently filtered schools and assign it to outreach.</div>
          </div>
        </div>
        <div class="panel-body stack">
          ${state.campaigns.map(campaignCard).join("") || `<div class="empty">No campaigns yet.</div>`}
        </div>
      </section>
      ${state.user.role === "admin" ? campaignForm() : remindersScreen(false)}
    </div>
  `;
}

function campaignCard(c) {
  const pct = c.total ? Math.round((c.contacted / c.total) * 100) : 0;
  return `
    <div class="history-item">
      <div class="row">
        <strong>${escapeHtml(c.name)}</strong>
        <span class="spacer"></span>
        <span class="badge">${pct}% contacted</span>
      </div>
      <p class="muted">${escapeHtml(c.description || "")}</p>
      <div class="bar"><span style="width:${pct}%"></span></div>
      <div class="muted">${c.contacted || 0} of ${c.total || 0} schools contacted</div>
    </div>
  `;
}

function campaignForm() {
  return `
    <form class="panel" onsubmit="createCampaign(event)">
      <div class="panel-head"><strong>New campaign</strong></div>
      <div class="panel-body stack">
        <div class="field"><label>Name</label><input name="name" required /></div>
        <div class="field"><label>Description</label><textarea name="description"></textarea></div>
        <div class="field">
          <label>Assign to</label>
          <select name="assigned_to" required>
            ${state.users.filter((u) => u.role === "outreach").map((u) => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join("")}
          </select>
        </div>
        <p class="muted">This will use the ${state.schools.length} schools currently visible in the database filter.</p>
        <button class="btn" type="submit">Create and assign</button>
      </div>
    </form>
  `;
}

async function createCampaign(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  await api("/api/campaigns", {
    method: "POST",
    body: JSON.stringify({
      name: form.get("name"),
      description: form.get("description"),
      assigned_to: Number(form.get("assigned_to")),
      school_ids: state.schools.map((s) => s.id),
    }),
  });
  await Promise.all([loadCampaigns(), loadSchools()]);
  render();
}

function remindersScreen(wrapped = true) {
  const content = `
    <div class="panel-head"><strong>Follow-up reminders</strong><button class="btn secondary" onclick="loadReminders()">Refresh</button></div>
    <div class="panel-body stack">
      ${state.reminders.map((r) => `
        <div class="reminder-item">
          <strong>${escapeHtml(r.school_name)}</strong>
          <div class="muted">${escapeHtml(r.school_code)} · ${new Date(r.due_at).toLocaleString()}</div>
          <p>${escapeHtml(r.note)}</p>
        </div>
      `).join("") || `<div class="empty">No pending reminders.</div>`}
    </div>
  `;
  return wrapped ? `<section class="panel">${content}</section>` : `<section class="panel">${content}</section>`;
}

function mapScreen() {
  const total = state.mapData.states.reduce((sum, item) => sum + item.count, 0);
  return `
    <div class="split map-split">
      <section class="panel">
        <div class="panel-head">
          <div>
            <strong>India school map</strong>
            <div class="muted">Hover a state or district for school count. Click to drill down and open datasets.</div>
          </div>
          <span class="badge">${total} schools</span>
        </div>
        <div class="india-map" aria-label="India political map">
          ${geoMapSvg()}
        </div>
      </section>
      <section class="panel">
        <div class="panel-head">
          <div>
            <strong>${escapeHtml(state.selectedState || "Choose a state")}</strong>
            <div class="muted">District breakdown</div>
          </div>
          ${state.selectedState ? `<button class="btn secondary" onclick="clearMapState()">Clear</button>` : ""}
        </div>
        <div class="panel-body stack">
          ${state.selectedState ? districtList() : `<div class="empty">Click a state on the map to see districts.</div>`}
        </div>
      </section>
    </div>
  `;
}

function geoMapSvg() {
  if (!state.mapGeo) return `<div class="empty">Loading political map...</div>`;
  const stateCounts = Object.fromEntries(state.mapData.states.map((item) => [item.state, item.count]));
  const districtCounts = Object.fromEntries(state.mapData.districts.map((item) => [item.district, item.count]));
  const visible = state.selectedState
    ? state.mapGeo.features.filter((feature) => feature.properties.st_nm === state.selectedState)
    : state.mapGeo.features;
  const maxCount = Math.max(1, ...Object.values(state.selectedState ? districtCounts : stateCounts));
  const bounds = state.selectedState ? geometryBounds(visible) : { minLon: 67.0, maxLon: 98.0, minLat: 5.0, maxLat: 37.5 };
  const paths = visible.map((feature) => {
    const stateName = feature.properties.st_nm;
    const district = feature.properties.district;
    const count = state.selectedState ? districtCounts[district] || 0 : stateCounts[stateName] || 0;
    const tone = count ? 0.2 + (count / maxCount) * 0.64 : 0;
    const fill = count ? `rgba(14,124,134,${tone.toFixed(2)})` : "#e5ece9";
    const click = state.selectedState
      ? `openDistrictDataset('${escapeAttr(state.selectedState)}', '${escapeAttr(district)}')`
      : `selectMapState('${escapeAttr(stateName)}')`;
    const label = state.selectedState ? `${district}: ${count} schools` : `${stateName}: ${count} schools`;
    return `<path class="geo-path" d="${geoFeaturePath(feature, bounds)}" fill="${fill}" onclick="${click}"><title>${escapeHtml(label)}</title></path>`;
  }).join("");
  return `
    <svg class="geo-svg" viewBox="0 0 720 820" role="img">
      <rect width="720" height="820" fill="#eef5f2"></rect>
      <g>${paths}</g>
    </svg>
  `;
}

function geoFeaturePath(feature, bounds) {
  const geometry = feature.geometry;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.map((polygon) =>
    polygon.map((ring) =>
      ring.map(([lon, lat], index) => {
        const [x, y] = projectIndia(lon, lat, bounds);
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      }).join(" ") + " Z"
    ).join(" ")
  ).join(" ");
}

function geometryBounds(features) {
  const bounds = { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity };
  for (const feature of features) {
    const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const polygon of polygons) {
      for (const ring of polygon) {
        for (const [lon, lat] of ring) {
          bounds.minLon = Math.min(bounds.minLon, lon);
          bounds.maxLon = Math.max(bounds.maxLon, lon);
          bounds.minLat = Math.min(bounds.minLat, lat);
          bounds.maxLat = Math.max(bounds.maxLat, lat);
        }
      }
    }
  }
  if (!Number.isFinite(bounds.minLon)) return { minLon: 67.0, maxLon: 98.0, minLat: 5.0, maxLat: 37.5 };
  const lonPad = Math.max(0.05, (bounds.maxLon - bounds.minLon) * 0.12);
  const latPad = Math.max(0.05, (bounds.maxLat - bounds.minLat) * 0.12);
  return {
    minLon: bounds.minLon - lonPad,
    maxLon: bounds.maxLon + lonPad,
    minLat: bounds.minLat - latPad,
    maxLat: bounds.maxLat + latPad,
  };
}

function projectIndia(lon, lat, bounds) {
  const { minLon, maxLon, minLat, maxLat } = bounds;
  const width = 720;
  const height = 820;
  const pad = 34;
  const x = pad + ((lon - minLon) / (maxLon - minLon)) * (width - pad * 2);
  const y = height - pad - ((lat - minLat) / (maxLat - minLat)) * (height - pad * 2);
  return [x, y];
}

function districtList() {
  return state.mapData.districts.map((d) => `
    <button class="district-row" onclick="openDistrictDataset('${escapeAttr(state.selectedState)}', '${escapeAttr(d.district)}')">
      <span>${escapeHtml(d.district)}</span>
      <strong>${d.count}</strong>
    </button>
  `).join("") || `<div class="empty">No districts found for this state.</div>`;
}

async function selectMapState(name) {
  state.selectedState = name;
  await loadMap(name);
}

function clearMapState() {
  state.selectedState = "";
  loadMap();
}

async function openDistrictDataset(stateName, district) {
  state.advancedFilters = [
    { field: "STATE/ UT", value: stateName },
    { field: "DISTRICT", value: district },
  ];
  state.filters.search = "";
  state.filters.disposition = "";
  state.filters.campaign = "";
  state.tab = "database";
  await loadSchools();
}

function activityScreen() {
  const summaries = Object.entries(state.activity.summary);
  return `
    <div class="split">
      <section class="panel">
        <div class="panel-head">
          <div>
            <strong>Outreach activity</strong>
            <div class="muted">Calls, cell edits, and reminders created by each person.</div>
          </div>
          <div class="row">
            <select onchange="loadActivity(this.value)">
              <option value="">All team members</option>
              ${state.users.map((u) => `<option value="${u.id}">${escapeHtml(u.name)} (${u.role})</option>`).join("")}
            </select>
            <button class="btn secondary" onclick="loadActivity()">Refresh</button>
          </div>
        </div>
        <div class="panel-body stack">
          ${state.activity.events.map(activityItem).join("") || `<div class="empty">No activity yet.</div>`}
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><strong>Team summary</strong></div>
        <div class="panel-body stack">
          ${summaries.map(([name, s]) => `
            <div class="history-item">
              <strong>${escapeHtml(name)}</strong>
              <div class="row">
                <span class="badge">Calls ${s.calls}</span>
                <span class="badge">Edits ${s.edits}</span>
                <span class="badge">Reminders ${s.reminders}</span>
              </div>
            </div>
          `).join("") || `<div class="empty">No team activity in the selected period.</div>`}
        </div>
      </section>
    </div>
  `;
}

function activityItem(item) {
  return `
    <div class="history-item">
      <div class="row">
        <span class="badge ${item.type === "Call" ? "good" : item.type === "Reminder" ? "warn" : ""}">${escapeHtml(item.type)}</span>
        <strong>${escapeHtml(item.user_name)}</strong>
        <span class="spacer"></span>
        <span class="muted">${new Date(item.created_at).toLocaleString()}</span>
      </div>
      <div>${escapeHtml(item.school_name)} <span class="muted">${escapeHtml(item.school_code)}</span></div>
      <div class="muted">${escapeHtml(item.summary)}</div>
    </div>
  `;
}

function reportsScreen() {
  const r = state.reports;
  if (!r) return `<section class="panel"><div class="empty">Loading reports...</div></section>`;
  return `
    <div class="grid">
      ${metric("Daily calls", r.daily.calls)}
      ${metric("Weekly calls", r.weekly.calls)}
      ${metric("Monthly calls", r.monthly.calls)}
      ${metric("Monthly registrations", r.monthly.registrations)}
    </div>
    <section class="panel" style="margin-top:16px">
      <div class="panel-head"><strong>Disposition report</strong></div>
      <div class="panel-body stack">
        ${r.dispositions.map((d) => `<div><div class="row"><strong>${escapeHtml(d.disposition)}</strong><span class="spacer"></span>${d.count}</div><div class="bar"><span style="width:${Math.min(100, d.count)}%"></span></div></div>`).join("")}
      </div>
    </section>
    <section class="panel" style="margin-top:16px">
      <div class="panel-head"><strong>Campaign report</strong></div>
      <div class="panel-body stack">
        ${r.campaigns.map((c) => campaignCard(c)).join("") || `<div class="empty">No campaign data yet.</div>`}
      </div>
    </section>
  `;
}

function metric(label, value) {
  return `<div class="metric"><span class="muted">${label}</span><strong>${value || 0}</strong></div>`;
}

function uploadScreen() {
  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <strong>Bulk upload schools</strong>
          <div class="muted">Upload an Excel workbook. Columns A to AD are imported and missing school codes are generated.</div>
        </div>
      </div>
      <form class="panel-body stack" onsubmit="uploadExcel(event)">
        <input type="file" name="file" accept=".xlsx,.xlsm" required />
        <button class="btn" type="submit">Upload Excel</button>
      </form>
    </section>
  `;
}

async function uploadExcel(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const data = await api("/api/upload", { method: "POST", body: form, headers: {} });
  alert(`${data.imported} schools imported.`);
  await loadSchools();
}

function downloadCsv() {
  const rows = [state.fields, ...state.schools.map((s) => state.fields.map((f) => s[f] || ""))];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "school-crm-export.csv";
  a.click();
  URL.revokeObjectURL(url);
}

async function loadSchools() {
  const params = new URLSearchParams(Object.entries(state.filters).filter(([, v]) => v));
  for (const filter of state.advancedFilters) {
    if (filter.field && filter.value) params.set(`field.${filter.field}`, filter.value);
  }
  const data = await api(`/api/schools?${params}`);
  state.schools = data.schools;
  render();
}

async function loadUsers() {
  state.users = (await api("/api/users")).users;
}

async function loadCampaigns() {
  state.campaigns = (await api("/api/campaigns")).campaigns;
}

async function loadFilterOptions() {
  state.filterOptions = (await api("/api/filter-options")).options;
}

async function loadReminders() {
  state.reminders = (await api("/api/reminders")).reminders;
  render();
}

async function loadMap(stateName = state.selectedState) {
  if (!state.mapGeo) {
    state.mapGeo = await fetch("/assets/maps/india.geojson").then((res) => res.json());
  }
  const suffix = stateName ? `?state=${encodeURIComponent(stateName)}` : "";
  state.mapData = await api(`/api/map${suffix}`);
  state.selectedState = state.mapData.selected_state || "";
  render();
}

async function loadActivity(userId = "") {
  const suffix = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
  state.activity = await api(`/api/activity${suffix}`);
  render();
}

async function loadReports() {
  state.reports = await api("/api/reports");
  render();
}

async function bootstrap() {
  try {
    const me = await api("/api/me");
    state.user = me.user;
    state.fields = me.fields;
    await Promise.all([loadUsers(), loadCampaigns(), loadFilterOptions()]);
    await loadSchools();
  } catch (err) {
    logout();
  }
}

if (state.token) bootstrap();
else render();
