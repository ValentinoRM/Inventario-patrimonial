const STORAGE_KEY = "huamancaca-patrimonio-v1";
const LOCAL_USER_KEY = "huamancaca-patrimonio-local-user";
const HISTORY_KEY = "huamancaca-patrimonio-history-v1";
const CHECKS_KEY = "huamancaca-patrimonio-checks-v1";
const sampleAssets = [
  { id: "HC-0001", asset_code: "HC-0001", barcode: "", name: "Computadora de escritorio", category: "Equipos informáticos", quantity: 4, zone: "Administración", location: "Administración", custodian: "Oficina de administración", condition: "Bueno", acquired: "2024-02-12", value: 3200, notes: "Registro de demostración" },
  { id: "HC-0002", asset_code: "HC-0002", barcode: "", name: "Sillas de oficina", category: "Muebles", quantity: 12, zone: "Secretaría general", location: "Salón consistorial", custodian: "Secretaría general", condition: "Regular", acquired: "2022-06-18", value: 1800, notes: "Registro de demostración" },
  { id: "HC-0003", asset_code: "HC-0003", barcode: "", name: "Mesas de reunión", category: "Muebles", quantity: 3, zone: "Secretaría general", location: "Salón consistorial", custodian: "Secretaría general", condition: "Bueno", acquired: "2023-03-07", value: 2100, notes: "Registro de demostración" },
  { id: "HC-0004", asset_code: "HC-0004", barcode: "", name: "Impresora multifuncional", category: "Equipos informáticos", quantity: 2, zone: "Tesorería", location: "Tesorería", custodian: "Área de tesorería", condition: "Bueno", acquired: "2024-08-21", value: 2400, notes: "Registro de demostración" },
  { id: "HC-0005", asset_code: "HC-0005", barcode: "", name: "Archivadores metálicos", category: "Muebles", quantity: 5, zone: "Archivo central", location: "Archivo central", custodian: "Responsable de archivo", condition: "Regular", acquired: "2021-11-03", value: 1750, notes: "Registro de demostración" },
  { id: "HC-0006", asset_code: "HC-0006", barcode: "", name: "Proyector multimedia", category: "Equipos informáticos", quantity: 1, zone: "Desarrollo social", location: "Desarrollo social", custodian: "Área de desarrollo social", condition: "Malo", acquired: "2020-09-15", value: 1600, notes: "Registro de demostración" }
];

const settings = window.PATRIMONIAL_CONFIG ?? {};
const supabaseReady = Boolean(settings.supabaseUrl && settings.publishableKey && window.supabase?.createClient);
const supabaseClient = supabaseReady ? window.supabase.createClient(settings.supabaseUrl, settings.publishableKey) : null;
let assets = [];
let editingId = null;
let userRole = "user";
let currentUserId = null;
let localUserId = null;
let assetChecks = new Map();
let localHistory = [];
let transferAssetId = null;
let checkAssetId = null;
let importRows = [];
let importErrors = [];
let qrInstance = null;
let toastTimer;
let realtimeChannel = null;
let barcodeScanner = null;
let scanTarget = "lookup";
let scanHandled = false;

const rows = document.getElementById("assetRows");
const form = document.getElementById("assetForm");
const backdrop = document.getElementById("modalBackdrop");
const scannerBackdrop = document.getElementById("scannerBackdrop");
const transferBackdrop = document.getElementById("transferBackdrop");
const checkBackdrop = document.getElementById("checkBackdrop");
const importBackdrop = document.getElementById("importBackdrop");
const historyBackdrop = document.getElementById("historyBackdrop");
const attachmentsBackdrop = document.getElementById("attachmentsBackdrop");
const qrBackdrop = document.getElementById("qrBackdrop");
const assignmentBackdrop = document.getElementById("assignmentBackdrop");
const categoryFilter = document.getElementById("categoryFilter");
const conditionFilter = document.getElementById("conditionFilter");
const zoneFilter = document.getElementById("zoneFilter");
const locationFilter = document.getElementById("locationFilter");
const searchInput = document.getElementById("searchInput");
document.getElementById("setupNotice").hidden = supabaseReady;
document.getElementById("demoNotice").hidden = supabaseReady;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function saveLocalAssets() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
    return true;
  } catch {
    showToast("No se pudieron guardar los datos en este navegador.");
    return false;
  }
}

function mapDatabaseAsset(row) {
  return {
    id: row.id,
    asset_code: row.asset_code,
    barcode: row.barcode ?? "",
    name: row.name,
    category: row.category,
    quantity: row.quantity,
    zone: row.zone ?? "",
    location: row.location,
    custodian: row.custodian ?? "",
    condition: row.condition,
    acquired: row.acquired_on ?? "",
    value: Number(row.value) || 0,
    notes: row.notes ?? "",
    maintenance_due: row.maintenance_due ?? "",
    maintenance_notes: row.maintenance_notes ?? "",
    created_by: row.created_by
  };
}

async function loadRemoteAssets(showErrors = true) {
  const { data, error } = await supabaseClient.from("assets").select("*").order("created_at", { ascending: false });
  if (error) {
    document.getElementById("databaseStatus").textContent = "Error al conectar con la base de datos";
    if (showErrors) showToast(`No se pudo cargar el inventario: ${error.message}`);
    return;
  }
  assets = data.map(mapDatabaseAsset);
  await loadRemoteChecks();
  document.getElementById("databaseStatus").textContent = "Base compartida · cambios sincronizados";
  render();
  await renderRecentHistory();
  openLinkedAsset();
}

async function loadRemoteChecks() {
  const { data, error } = await supabaseClient.from("asset_checks").select("*").order("checked_at", { ascending: false });
  if (error) {
    showToast(`No se pudieron cargar las verificaciones: ${error.message}`);
    return;
  }
  assetChecks = new Map();
  for (const check of data) if (!assetChecks.has(check.asset_id)) assetChecks.set(check.asset_id, check);
}

async function enterWithUser(user) {
  userRole = user.app_metadata?.role === "admin" ? "admin" : "user";
  currentUserId = user.id;
  document.getElementById("authScreen").hidden = true;
  document.querySelector(".app").hidden = false;
  document.getElementById("activeUser").textContent = user.email || "Usuario municipal";
  document.getElementById("connectionLabel").textContent = `Sesión municipal · ${userRole === "admin" ? "Administrador" : "Usuario"}`;
  document.getElementById("signOutBtn").hidden = false;
  document.getElementById("roleAdminSection").hidden = userRole !== "admin";
  await loadRemoteAssets();
  if (userRole === "admin") await loadAdminUsers();
  if (realtimeChannel) await supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel = supabaseClient
    .channel("municipal-assets-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "assets" }, () => loadRemoteAssets(false))
    .subscribe();
}

function showLogin(errorMessage = "") {
  document.querySelector(".app").hidden = true;
  document.getElementById("authScreen").hidden = false;
  document.getElementById("signOutBtn").hidden = true;
  const errorBox = document.getElementById("authError");
  errorBox.textContent = errorMessage;
  errorBox.hidden = !errorMessage;
}

function render() {
  const query = searchInput.value.trim().toLocaleLowerCase("es");
  const filtered = assets.filter(asset => {
    const matchesQuery = [asset.name, asset.asset_code, asset.barcode, asset.zone, asset.location, asset.category, asset.custodian].some(value => String(value ?? "").toLocaleLowerCase("es").includes(query));
    return matchesQuery && (!zoneFilter.value || (String(asset.zone ?? "").trim() || "Sin zona") === zoneFilter.value) && (!locationFilter.value || asset.location === locationFilter.value) && (!categoryFilter.value || asset.category === categoryFilter.value) && (!conditionFilter.value || asset.condition === conditionFilter.value);
  });
  rows.innerHTML = filtered.map(asset => `<tr>
    <td><div class="asset-name">${escapeHtml(asset.name)}</div><div class="asset-code">${escapeHtml(asset.asset_code || asset.id)}</div></td>
    <td>${asset.barcode ? `<span class="asset-barcode">${escapeHtml(asset.barcode)}</span>` : "<span class=\"asset-barcode\">Sin código</span>"}</td>
    <td><span class="category-pill">${escapeHtml(asset.category)}</span></td>
    <td>${Number(asset.quantity) || 0}</td>
    <td>${escapeHtml(asset.zone || "Sin zona")}</td>
    <td>${escapeHtml(asset.location)}</td>
    <td>${escapeHtml(asset.custodian || "Sin asignar")}</td>
    <td><span class="status-pill status-${escapeHtml(asset.condition.toLocaleLowerCase("es"))}">${escapeHtml(asset.condition)}</span></td>
    <td><span class="check-status status-${escapeHtml(assetChecks.get(asset.id)?.status ?? "unchecked")}">${escapeHtml(checkStatusLabel(assetChecks.get(asset.id)?.status))}</span></td>
    <td><div class="row-actions">
      <button class="icon-button" type="button" data-action="edit" data-id="${escapeHtml(asset.id)}" aria-label="Editar ${escapeHtml(asset.name)}" title="Editar">✎</button>
      <button class="icon-button" type="button" data-action="transfer" data-id="${escapeHtml(asset.id)}" aria-label="Trasladar ${escapeHtml(asset.name)}" title="Trasladar">⇄</button>
      <button class="icon-button" type="button" data-action="check" data-id="${escapeHtml(asset.id)}" aria-label="Verificar ${escapeHtml(asset.name)}" title="Verificar">✓</button>
      <button class="icon-button" type="button" data-action="qr" data-id="${escapeHtml(asset.id)}" aria-label="Etiqueta QR de ${escapeHtml(asset.name)}" title="Etiqueta QR">▦</button>
      <button class="icon-button" type="button" data-action="history" data-id="${escapeHtml(asset.id)}" aria-label="Historial de ${escapeHtml(asset.name)}" title="Historial">◷</button>
      <button class="icon-button" type="button" data-action="attachments" data-id="${escapeHtml(asset.id)}" aria-label="Adjuntos de ${escapeHtml(asset.name)}" title="Fotos y documentos">⌕</button>
      ${canDeleteAsset(asset) ? `<button class="icon-button delete" type="button" data-action="delete" data-id="${escapeHtml(asset.id)}" aria-label="Eliminar ${escapeHtml(asset.name)}" title="Eliminar">×</button>` : ""}
    </div></td>
  </tr>`).join("");
  document.getElementById("emptyState").hidden = filtered.length > 0;
  document.querySelector(".table-scroll table").hidden = filtered.length === 0;
  const totalUnits = assets.reduce((total, asset) => total + (Number(asset.quantity) || 0), 0);
  const goodUnits = assets.filter(asset => asset.condition === "Bueno").reduce((total, asset) => total + (Number(asset.quantity) || 0), 0);
  const attentionUnits = assets.filter(asset => asset.condition !== "Bueno").reduce((total, asset) => total + (Number(asset.quantity) || 0), 0);
  const locations = new Set(assets.map(asset => asset.location.trim().toLocaleLowerCase("es")).filter(Boolean));
  document.getElementById("metricItems").textContent = totalUnits.toLocaleString("es-PE");
  document.getElementById("metricGood").textContent = goodUnits.toLocaleString("es-PE");
  document.getElementById("metricAttention").textContent = attentionUnits.toLocaleString("es-PE");
  document.getElementById("metricLocations").textContent = locations.size.toLocaleString("es-PE");
  document.getElementById("resultCount").textContent = `${filtered.length} ${filtered.length === 1 ? "registro" : "registros"}`;
  document.getElementById("tableFootCount").textContent = `${filtered.reduce((total, asset) => total + (Number(asset.quantity) || 0), 0)} bienes`;
  document.getElementById("demoNotice").hidden = supabaseReady || Boolean(localStorage.getItem(STORAGE_KEY));
  const categories = [...new Set(assets.map(asset => asset.category))].sort((a, b) => a.localeCompare(b, "es"));
  const selected = categoryFilter.value;
  categoryFilter.innerHTML = `<option value="">Todas las categorías</option>${categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}`;
  categoryFilter.value = categories.includes(selected) ? selected : "";
  const zones = [...new Set(assets.map(asset => String(asset.zone ?? "").trim() || "Sin zona"))].sort((a, b) => a.localeCompare(b, "es"));
  const selectedZone = zoneFilter.value;
  zoneFilter.innerHTML = `<option value="">Todas las zonas</option>${zones.map(zone => `<option value="${escapeHtml(zone)}">${escapeHtml(zone)}</option>`).join("")}`;
  zoneFilter.value = zones.includes(selectedZone) ? selectedZone : "";
  const locationsList = [...new Set(assets.map(asset => asset.location).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const selectedLocation = locationFilter.value;
  locationFilter.innerHTML = `<option value="">Todos los ambientes</option>${locationsList.map(location => `<option value="${escapeHtml(location)}">${escapeHtml(location)}</option>`).join("")}`;
  locationFilter.value = locationsList.includes(selectedLocation) ? selectedLocation : "";
  const assignmentZone = document.getElementById("assignmentZone");
  const assignmentSelected = assignmentZone.value;
  assignmentZone.innerHTML = `<option value="">Todas las zonas</option>${zones.map(zone => `<option value="${escapeHtml(zone)}">${escapeHtml(zone)}</option>`).join("")}`;
  assignmentZone.value = zones.includes(assignmentSelected) ? assignmentSelected : "";
  renderZoneReport();
  renderOperations();
}

function checkStatusLabel(status) {
  return ({ verified: "Verificado", missing: "No encontrado", needs_attention: "Revisar" })[status] ?? "Pendiente";
}

function renderOperations() {
  const inspected = assets.filter(asset => assetChecks.has(asset.id));
  const verified = inspected.filter(asset => assetChecks.get(asset.id)?.status === "verified").length;
  const percentage = assets.length ? Math.round(verified / assets.length * 100) : 0;
  document.getElementById("verificationPercent").textContent = `${percentage}%`;
  document.getElementById("verificationCount").textContent = `${verified} de ${assets.length} bienes verificados`;
  document.getElementById("verificationProgress").style.width = `${percentage}%`;
  document.getElementById("verificationSummary").textContent = `${inspected.length} revisados · ${inspected.length - verified} pendientes o con observaciones.`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = assets
    .filter(asset => asset.maintenance_due)
    .map(asset => ({ ...asset, days: Math.ceil((new Date(`${asset.maintenance_due}T00:00:00`) - today) / 86400000) }))
    .filter(asset => asset.days <= 30)
    .sort((a, b) => a.days - b.days);
  document.getElementById("maintenanceCount").textContent = String(upcoming.length);
  document.getElementById("maintenanceList").innerHTML = upcoming.length
    ? upcoming.map(asset => `<div class="maintenance-item"><span class="maintenance-date${asset.days < 0 ? " overdue" : ""}">${asset.days < 0 ? `${Math.abs(asset.days)} d vencido` : asset.days === 0 ? "Hoy" : `${asset.days} d`}</span><span><strong>${escapeHtml(asset.name)}</strong><small>${escapeHtml(asset.maintenance_notes || asset.maintenance_due)} · ${escapeHtml(asset.zone || "Sin zona")}</small></span><button class="text-action" type="button" data-action="edit" data-id="${escapeHtml(asset.id)}">Ver</button></div>`).join("")
    : "<p class=\"operations-hint\">No hay mantenimientos programados para los próximos 30 días.</p>";

  const grouped = new Map();
  for (const asset of assets) {
    const zone = String(asset.zone ?? "").trim() || "Sin zona";
    const location = String(asset.location ?? "").trim() || "Sin ambiente";
    if (!grouped.has(zone)) grouped.set(zone, new Map());
    grouped.get(zone).set(location, (grouped.get(zone).get(location) ?? 0) + (Number(asset.quantity) || 0));
  }
  const map = document.getElementById("locationMap");
  map.innerHTML = [...grouped].sort((a, b) => a[0].localeCompare(b[0], "es")).map(([zone, locations]) => `<section class="map-zone"><button class="map-zone-title" type="button" data-zone="${escapeHtml(zone)}">${escapeHtml(zone)}<span>${[...locations.values()].reduce((sum, amount) => sum + amount, 0)} bienes</span></button><div class="map-locations">${[...locations].sort((a, b) => a[0].localeCompare(b[0], "es")).map(([location, quantity]) => `<button class="map-location${zoneFilter.value === zone && locationFilter.value === location ? " selected" : ""}" type="button" data-zone="${escapeHtml(zone)}" data-location="${escapeHtml(location)}"><span class="map-dot"></span><span>${escapeHtml(location)}</span><strong>${quantity}</strong></button>`).join("")}</div></section>`).join("") || "<p class=\"operations-hint\">Registra bienes para ver el esquema de zonas y ambientes.</p>";
}

async function renderRecentHistory() {
  let events = localHistory.slice(0, 8);
  if (supabaseReady && assets.length) {
    const { data, error } = await supabaseClient.from("asset_history").select("*").order("created_at", { ascending: false }).limit(8);
    if (error) {
      document.getElementById("recentHistory").innerHTML = `<p class="operations-hint">No se pudo cargar el historial: ${escapeHtml(error.message)}</p>`;
      return;
    }
    events = data;
  }
  const historyEl = document.getElementById("recentHistory");
  historyEl.innerHTML = events.length ? events.map(renderHistoryEvent).join("") : "<p class=\"operations-hint\">Las acciones sobre los bienes aparecerán aquí.</p>";
}

function renderHistoryEvent(event) {
  const type = event.event_type ?? event.type ?? "updated";
  const labels = { created: "Bien registrado", updated: "Datos actualizados", transferred: "Bien trasladado", deleted: "Bien eliminado", verified: "Verificación física" };
  const snapshot = event.new_data ?? event.old_data ?? event.data ?? {};
  const detail = type === "transferred"
    ? `${snapshot.zone || "Sin zona"} · ${snapshot.location || "Sin ambiente"}`
    : snapshot.name || event.notes || "";
  const timestamp = event.created_at ?? event.checked_at ?? new Date().toISOString();
  return `<article class="history-entry"><span class="history-marker history-${escapeHtml(type)}"></span><div><strong>${escapeHtml(labels[type] || type)}</strong><span>${escapeHtml(event.asset_code || snapshot.asset_code || "Bien")} · ${escapeHtml(detail)}</span></div><time datetime="${escapeHtml(timestamp)}">${escapeHtml(new Date(timestamp).toLocaleString("es-PE"))}</time></article>`;
}

function addLocalHistory(asset, eventType, oldData = null, newData = null) {
  localHistory.unshift({
    asset_id: asset.id,
    asset_code: asset.asset_code || asset.id,
    event_type: eventType,
    old_data: oldData,
    new_data: newData,
    created_at: new Date().toISOString()
  });
  localHistory = localHistory.slice(0, 500);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(localHistory));
}

function saveLocalChecks() {
  localStorage.setItem(CHECKS_KEY, JSON.stringify([...assetChecks.entries()]));
}

function openLinkedAsset() {
  const code = new URLSearchParams(window.location.search).get("asset");
  if (!code || !assets.length) return;
  const asset = assets.find(item => item.asset_code === code || item.id === code || item.barcode === code);
  if (!asset) {
    showToast(`No se encontró el bien ${code}.`);
    return;
  }
  searchInput.value = code;
  render();
  showToast(`Ficha encontrada: ${asset.name}`);
  window.history.replaceState({}, "", window.location.pathname);
}

function canDeleteAsset(asset) {
  return supabaseReady
    ? userRole === "admin" || Boolean(currentUserId && asset.created_by === currentUserId)
    : asset.created_by === currentUserId;
}

async function loadAdminUsers() {
  const status = document.getElementById("roleAdminStatus");
  status.textContent = "Cargando usuarios...";
  try {
    const { data, error } = await supabaseClient.functions.invoke("admin-users", { body: { action: "list" } });
    if (error) throw error;
    const users = data?.users;
    if (!Array.isArray(users)) throw new Error("La función no devolvió una lista válida de usuarios.");
    document.getElementById("userRows").innerHTML = users.map(user => `<tr>
      <td>${escapeHtml(user.email || "Sin correo")}</td>
      <td><select class="user-role-select" aria-label="Rol de ${escapeHtml(user.email || "usuario")}" data-role="${escapeHtml(user.role)}"><option value="user"${user.role === "user" ? " selected" : ""}>Usuario</option><option value="admin"${user.role === "admin" ? " selected" : ""}>Administrador</option></select></td>
      <td><button class="button button-light user-role-save" type="button" data-user-id="${escapeHtml(user.id)}" data-user-email="${escapeHtml(user.email || "")}">Guardar rol</button></td>
    </tr>`).join("");
    status.textContent = `${users.length} ${users.length === 1 ? "usuario autorizado" : "usuarios autorizados"}.`;
  } catch (error) {
    status.textContent = `No se pudo cargar usuarios: ${error.message}. Verifica que la función segura "admin-users" esté desplegada.`;
  }
}

async function saveUserRole(button) {
  const row = button.closest("tr");
  const role = row.querySelector(".user-role-select").value;
  button.disabled = true;
  try {
    const { error } = await supabaseClient.functions.invoke("admin-users", {
      body: { action: "set_role", userId: button.dataset.userId, role }
    });
    if (error) throw error;
    document.getElementById("roleAdminStatus").textContent = `Rol actualizado para ${button.dataset.userEmail}. La persona afectada debe cerrar sesión y volver a ingresar para renovar su rol.`;
    await loadAdminUsers();
  } catch (error) {
    document.getElementById("roleAdminStatus").textContent = `No se pudo actualizar el rol: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

function renderZoneReport() {
  const counts = new Map();
  for (const asset of assets) {
    const zone = String(asset.zone ?? "").trim() || "Sin zona";
    counts.set(zone, (counts.get(zone) ?? 0) + (Number(asset.quantity) || 0));
  }
  const zones = [...counts].sort((a, b) => a[0].localeCompare(b[0], "es"));
  const colors = ["#2f7561", "#1755a0", "#c69b2c", "#9e3a3b", "#8055a5", "#26a5a0", "#dd7542", "#668239"];
  const total = zones.reduce((sum, [, quantity]) => sum + quantity, 0);
  const circumference = 2 * Math.PI * 42;
  let offset = 0;
  const chart = document.getElementById("zoneChart");
  chart.innerHTML = zones.map(([zone, quantity], index) => {
    const segment = total ? quantity / total * circumference : 0;
    const segmentMarkup = `<circle class="zone-segment${zoneFilter.value === zone ? " selected" : ""}" data-zone="${escapeHtml(zone)}" cx="60" cy="60" r="42" fill="none" stroke="${colors[index % colors.length]}" stroke-width="16" stroke-dasharray="${segment} ${circumference - segment}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)" role="button" tabindex="0" aria-label="${escapeHtml(zone)}: ${quantity} unidades" aria-pressed="${zoneFilter.value === zone}"></circle>`;
    offset += segment;
    return segmentMarkup;
  }).join("");
  const selectedCount = zoneFilter.value ? counts.get(zoneFilter.value) ?? 0 : total;
  document.getElementById("chartTotal").textContent = selectedCount.toLocaleString("es-PE");
  const legend = document.getElementById("zoneLegend");
  legend.innerHTML = zones.map(([zone, quantity], index) => `<button class="zone-legend-item${zoneFilter.value === zone ? " selected" : ""}" type="button" data-zone="${escapeHtml(zone)}" aria-pressed="${zoneFilter.value === zone}"><span class="zone-swatch" style="--zone-color:${colors[index % colors.length]}"></span><span>${escapeHtml(zone)}</span><strong>${quantity.toLocaleString("es-PE")}</strong></button>`).join("") || "<span class=\"zone-empty\">Aún no hay bienes registrados.</span>";
  chart.querySelectorAll("[data-zone]").forEach(segment => {
    segment.addEventListener("click", () => toggleZone(segment.dataset.zone));
    segment.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleZone(segment.dataset.zone);
      }
    });
  });
  legend.querySelectorAll("[data-zone]").forEach(button => button.addEventListener("click", () => toggleZone(button.dataset.zone)));
}

function toggleZone(zone) {
  zoneFilter.value = zoneFilter.value === zone ? "" : zone;
  render();
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function openModal(asset = null) {
  editingId = asset?.id ?? null;
  form.reset();
  form.elements.quantity.value = 1;
  document.getElementById("modalTitle").textContent = editingId ? "Editar bien" : "Registrar bien";
  document.getElementById("saveBtn").textContent = editingId ? "Guardar cambios" : "Guardar bien";
  if (asset) {
    for (const key of ["name", "category", "quantity", "condition", "zone", "location", "custodian", "acquired", "value", "notes", "barcode"]) form.elements[key].value = asset[key] ?? "";
    form.elements.maintenance_due.value = asset.maintenance_due ?? "";
    form.elements.maintenance_notes.value = asset.maintenance_notes ?? "";
  }
  form.elements.asset_files.value = "";
  backdrop.classList.add("open");
  document.getElementById("name").focus();
}

function closeModal() {
  backdrop.classList.remove("open");
  editingId = null;
}

document.getElementById("addBtn").addEventListener("click", () => openModal());
document.getElementById("closeModal").addEventListener("click", closeModal);
document.getElementById("cancelModal").addEventListener("click", closeModal);
backdrop.addEventListener("click", event => { if (event.target === backdrop) closeModal(); });
document.addEventListener("keydown", event => { if (event.key === "Escape" && backdrop.classList.contains("open")) closeModal(); });
form.addEventListener("submit", async event => {
  event.preventDefault();
  const data = new FormData(form);
  const values = Object.fromEntries(data.entries());
  const current = editingId ? assets.find(asset => asset.id === editingId) : null;
  const payload = {
    name: values.name.trim(),
    category: values.category,
    barcode: values.barcode.trim() || null,
    quantity: Number(values.quantity),
    zone: values.zone.trim(),
    location: values.location.trim(),
    custodian: values.custodian.trim(),
    condition: values.condition,
    acquired_on: values.acquired || null,
    value: Number(values.value) || 0,
    notes: values.notes.trim(),
    maintenance_due: values.maintenance_due || null,
    maintenance_notes: values.maintenance_notes.trim()
  };
  const selectedFiles = [...document.getElementById("assetFiles").files];
  const saveButton = document.getElementById("saveBtn");
  saveButton.disabled = true;
  try {
    if (supabaseReady) {
      const request = current
        ? supabaseClient.from("assets").update(payload).eq("id", editingId).select().single()
        : supabaseClient.from("assets").insert(payload).select().single();
      const { data: savedAsset, error } = await request;
      if (error) throw error;
      if (current) assets = assets.map(item => item.id === editingId ? mapDatabaseAsset(savedAsset) : item);
      else assets.unshift(mapDatabaseAsset(savedAsset));
    } else {
      const lastNumber = Math.max(0, ...assets.map(item => Number((item.asset_code || item.id).split("-")[1]) || 0));
      const nextCode = `HC-${String(lastNumber + 1).padStart(4, "0")}`;
      const localAsset = { ...payload, acquired: payload.acquired_on || "", id: current?.id ?? nextCode, asset_code: current?.asset_code ?? nextCode, barcode: payload.barcode ?? "", created_by: current?.created_by ?? localUserId, attachments: current?.attachments ?? [] };
      delete localAsset.acquired_on;
      if (current) assets = assets.map(item => item.id === editingId ? localAsset : item);
      else assets.unshift(localAsset);
      if (!saveLocalAssets()) return;
      const moved = current && (current.zone !== localAsset.zone || current.location !== localAsset.location || current.custodian !== localAsset.custodian);
      addLocalHistory(localAsset, moved ? "transferred" : current ? "updated" : "created", current, localAsset);
    }
    const savedAssetId = current?.id ?? assets[0].id;
    render();
    closeModal();
    let attachmentFailed = false;
    if (selectedFiles.length) {
      try {
        if (supabaseReady) await uploadAssetFiles(savedAssetId, selectedFiles);
        else await saveDemoAttachments(savedAssetId, selectedFiles);
      } catch (error) {
        attachmentFailed = true;
        showToast(`El bien se guardó, pero no se pudieron adjuntar los archivos: ${error.message}`);
      }
    }
    if (!attachmentFailed) showToast(current ? "Cambios guardados." : "Bien registrado correctamente.");
  } catch (error) {
    showToast(error.message?.includes("barcode") ? "Ese código de barras ya está registrado." : `No se pudo guardar: ${error.message}`);
  } finally {
    saveButton.disabled = false;
  }
});
rows.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const asset = assets.find(item => item.id === button.dataset.id);
  if (!asset) return;
  if (button.dataset.action === "edit") openModal(asset);
  if (button.dataset.action === "transfer") openTransferModal(asset);
  if (button.dataset.action === "check") openCheckModal(asset);
  if (button.dataset.action === "qr") openQrModal(asset);
  if (button.dataset.action === "history") openAssetHistory(asset);
  if (button.dataset.action === "attachments") await openAssetAttachments(asset);
  if (button.dataset.action === "delete" && supabaseReady && userRole !== "admin") {
    if (asset.created_by !== currentUserId) {
      showToast("Solo quien registró este bien o un administrador puede eliminarlo.");
      return;
    }
  }
  if (button.dataset.action === "delete" && !supabaseReady && asset.created_by !== currentUserId) {
    showToast("Solo quien registró este bien puede eliminarlo.");
    return;
  }
  if (button.dataset.action === "delete" && confirm(`¿Eliminar "${asset.name}" (${asset.id}) del inventario?`)) {
    try {
      if (supabaseReady) {
        let request = supabaseClient.from("assets").delete().eq("id", asset.id);
        if (userRole !== "admin") request = request.eq("created_by", currentUserId);
        const { data, error } = await request.select("id");
        if (error) throw error;
        if (!data?.length) throw new Error("No tienes permiso para eliminar este bien.");
      }
      assets = assets.filter(item => item.id !== asset.id);
      if (!supabaseReady) {
        addLocalHistory(asset, "deleted", asset, null);
        saveLocalAssets();
      }
      render();
      showToast("Bien eliminado del inventario.");
    } catch (error) {
      showToast(`No se pudo eliminar: ${error.message}`);
    }
  }
});

function openTransferModal(asset) {
  transferAssetId = asset.id;
  document.getElementById("transferAssetName").textContent = `${asset.name} · ${asset.asset_code}`;
  document.getElementById("transferZone").value = asset.zone || "";
  document.getElementById("transferLocation").value = asset.location || "";
  document.getElementById("transferCustodian").value = asset.custodian || "";
  document.getElementById("transferReason").value = "";
  transferBackdrop.classList.add("open");
}

function closeTransferModal() {
  transferBackdrop.classList.remove("open");
  transferAssetId = null;
}

document.getElementById("transferForm").addEventListener("submit", async event => {
  event.preventDefault();
  const asset = assets.find(item => item.id === transferAssetId);
  if (!asset) return;
  const payload = {
    zone: document.getElementById("transferZone").value.trim(),
    location: document.getElementById("transferLocation").value.trim(),
    custodian: document.getElementById("transferCustodian").value.trim()
  };
  const reason = document.getElementById("transferReason").value.trim();
  const submit = event.currentTarget.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    if (supabaseReady) {
      const { data, error } = await supabaseClient.from("assets").update({ ...payload, ...(reason ? { notes: `${asset.notes ? `${asset.notes}\n` : ""}Traslado ${new Date().toLocaleDateString("es-PE")}: ${reason}`.slice(0, 300) } : {}) }).eq("id", asset.id).select().single();
      if (error) throw error;
      assets = assets.map(item => item.id === asset.id ? mapDatabaseAsset(data) : item);
    } else {
      const moved = { ...asset, ...payload, ...(reason ? { notes: `${asset.notes ? `${asset.notes}\n` : ""}Traslado ${new Date().toLocaleDateString("es-PE")}: ${reason}`.slice(0, 300) } : {}) };
      assets = assets.map(item => item.id === asset.id ? moved : item);
      addLocalHistory(moved, "transferred", asset, moved);
      if (!saveLocalAssets()) throw new Error("No se pudieron guardar los cambios localmente.");
    }
    closeTransferModal();
    render();
    if (supabaseReady) await renderRecentHistory();
    showToast("Traslado registrado correctamente.");
  } catch (error) {
    showToast(`No se pudo registrar el traslado: ${error.message}`);
  } finally {
    submit.disabled = false;
  }
});

function openCheckModal(asset) {
  checkAssetId = asset.id;
  document.getElementById("checkAssetName").textContent = `${asset.name} · ${asset.asset_code}`;
  document.getElementById("checkStatus").value = assetChecks.get(asset.id)?.status ?? "verified";
  document.getElementById("checkNotes").value = "";
  checkBackdrop.classList.add("open");
}

function closeCheckModal() {
  checkBackdrop.classList.remove("open");
  checkAssetId = null;
}

document.getElementById("checkForm").addEventListener("submit", async event => {
  event.preventDefault();
  const payload = {
    asset_id: checkAssetId,
    status: document.getElementById("checkStatus").value,
    notes: document.getElementById("checkNotes").value.trim()
  };
  const submit = event.currentTarget.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    let check;
    if (supabaseReady) {
      const { data, error } = await supabaseClient.from("asset_checks").insert(payload).select().single();
      if (error) throw error;
      check = data;
    } else {
      check = { ...payload, checked_by: currentUserId, checked_at: new Date().toISOString() };
      const previous = localHistory;
      localHistory.unshift({ ...check, asset_code: assets.find(item => item.id === payload.asset_id)?.asset_code, event_type: "verified", created_at: check.checked_at, notes: `${checkStatusLabel(check.status)}${check.notes ? ` · ${check.notes}` : ""}` });
      localHistory = localHistory.slice(0, 500);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(localHistory));
    }
    assetChecks.set(payload.asset_id, check);
    if (!supabaseReady) saveLocalChecks();
    closeCheckModal();
    render();
    await renderRecentHistory();
    showToast(`Verificación guardada: ${checkStatusLabel(check.status)}.`);
  } catch (error) {
    showToast(`No se pudo guardar la verificación: ${error.message}`);
  } finally {
    submit.disabled = false;
  }
});

async function uploadAssetFiles(assetId, files) {
  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} supera el límite de 5 MB.`);
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) throw new Error(`${file.name} no es una imagen o PDF permitido.`);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${assetId}/${currentUserId}-${Date.now()}-${safeName}`;
    const { error } = await supabaseClient.storage.from("asset-attachments").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
  }
}

async function saveDemoAttachments(assetId, files) {
  const asset = assets.find(item => item.id === assetId);
  if (!asset) throw new Error("No se encontró el bien.");
  const attachments = [...(asset.attachments ?? [])];
  for (const file of files) {
    if (file.size > 1024 * 1024) throw new Error(`${file.name} supera el límite local de 1 MB.`);
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) throw new Error(`${file.name} no es una imagen o PDF permitido.`);
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}.`));
      reader.readAsDataURL(file);
    });
    attachments.push({ name: file.name, dataUrl, created_at: new Date().toISOString() });
  }
  assets = assets.map(item => item.id === assetId ? { ...item, attachments } : item);
  if (!saveLocalAssets()) throw new Error("No hay espacio local suficiente para guardar los archivos.");
}

async function openAssetAttachments(asset) {
  document.getElementById("attachmentsAssetName").textContent = `${asset.name} · ${asset.asset_code}`;
  const list = document.getElementById("attachmentList");
  list.textContent = "Cargando archivos...";
  attachmentsBackdrop.classList.add("open");
  try {
    let files;
    if (supabaseReady) {
      const prefix = asset.id;
      const { data, error } = await supabaseClient.storage.from("asset-attachments").list(prefix, { limit: 100 });
      if (error) throw error;
      files = await Promise.all(data.map(async file => {
        const filePath = `${prefix}/${file.name}`;
        const { data: signed, error: signedError } = await supabaseClient.storage.from("asset-attachments").createSignedUrl(filePath, 300);
        if (signedError) throw signedError;
        return { name: file.name, url: signed.signedUrl };
      }));
    } else {
      files = (asset.attachments ?? []).map(file => ({ name: file.name, url: file.dataUrl }));
    }
    list.innerHTML = files.length
      ? files.map(file => `<a class="attachment-link" href="${escapeHtml(file.url)}" target="_blank" rel="noopener">${escapeHtml(file.name)}<span>Abrir archivo</span></a>`).join("")
      : "<p class=\"operations-hint\">No hay archivos adjuntos. Edita el bien para añadir fotos, actas o documentos.</p>";
  } catch (error) {
    list.innerHTML = `<p class="operations-hint">No se pudieron cargar los adjuntos: ${escapeHtml(error.message)}</p>`;
  }
}

async function openAssetHistory(asset) {
  document.getElementById("historyAssetName").textContent = `${asset.name} · ${asset.asset_code}`;
  const list = document.getElementById("assetHistory");
  list.textContent = "Cargando historial...";
  historyBackdrop.classList.add("open");
  try {
    let events = localHistory.filter(event => event.asset_id === asset.id);
    if (supabaseReady) {
      const { data, error } = await supabaseClient.from("asset_history").select("*").eq("asset_id", asset.id).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      events = data;
    }
    list.innerHTML = events.length ? events.map(renderHistoryEvent).join("") : "<p class=\"operations-hint\">Este bien aún no tiene movimientos registrados.</p>";
  } catch (error) {
    list.innerHTML = `<p class="operations-hint">No se pudo cargar el historial: ${escapeHtml(error.message)}</p>`;
  }
}

function openQrModal(asset) {
  document.getElementById("qrAssetName").textContent = asset.name;
  document.getElementById("qrAssetCode").textContent = asset.asset_code || asset.id;
  document.getElementById("qrAssetDescription").textContent = `${asset.zone || "Sin zona"} · ${asset.location}`;
  const container = document.getElementById("qrCode");
  container.replaceChildren();
  qrBackdrop.classList.add("open");
  if (!window.QRCode) {
    container.textContent = "No se pudo cargar el generador QR. Revisa tu conexión a internet.";
    return;
  }
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("asset", asset.asset_code || asset.id);
  qrInstance = new window.QRCode(container, { text: url.toString(), width: 180, height: 180, correctLevel: window.QRCode.CorrectLevel.M });
}

function printQrLabel() {
  const image = document.querySelector("#qrCode img")?.src ?? document.querySelector("#qrCode canvas")?.toDataURL("image/png");
  if (!image) {
    showToast("El código QR aún no está disponible para imprimir.");
    return;
  }
  const popup = window.open("", "_blank");
  if (!popup) {
    showToast("Permite las ventanas emergentes para imprimir la etiqueta.");
    return;
  }
  popup.document.write(`<!doctype html><html lang="es"><meta charset="utf-8"><title>Etiqueta patrimonial</title><style>body{font:14px Arial;text-align:center;padding:18px}img{width:180px;height:180px}.label{border:1px solid #aaa;display:inline-grid;gap:7px;padding:12px;max-width:230px}small{color:#555}</style><div class="label"><img src="${image}" alt="Código QR"><strong>${escapeHtml(document.getElementById("qrAssetCode").textContent)}</strong><span>${escapeHtml(document.getElementById("qrAssetName").textContent)}</span><small>${escapeHtml(document.getElementById("qrAssetDescription").textContent)}</small></div><script>onload=()=>print()<\/script></html>`);
  popup.document.close();
}

function printAssignment(event) {
  event.preventDefault();
  const custodian = document.getElementById("assignmentCustodian").value.trim();
  const selectedZone = document.getElementById("assignmentZone").value;
  const date = document.getElementById("assignmentDate").value;
  const notes = document.getElementById("assignmentNotes").value.trim();
  const assignedAssets = assets.filter(asset => asset.custodian.trim().toLocaleLowerCase("es") === custodian.toLocaleLowerCase("es") && (!selectedZone || asset.zone === selectedZone));
  if (!assignedAssets.length) {
    showToast("No hay bienes asignados a esa persona con los filtros elegidos.");
    return;
  }
  const popup = window.open("", "_blank");
  if (!popup) {
    showToast("Permite las ventanas emergentes para generar el acta.");
    return;
  }
  const items = assignedAssets.map(asset => `<tr><td>${escapeHtml(asset.asset_code)}</td><td>${escapeHtml(asset.name)}</td><td>${escapeHtml(asset.zone)}</td><td>${escapeHtml(asset.location)}</td><td>${asset.quantity}</td><td>${escapeHtml(asset.condition)}</td></tr>`).join("");
  popup.document.write(`<!doctype html><html lang="es"><meta charset="utf-8"><title>Acta de asignación patrimonial</title><style>body{font:12px Arial;margin:30px;color:#222}h1{text-align:center;font-size:18px}p{line-height:1.6}table{border-collapse:collapse;width:100%;margin:20px 0}th,td{border:1px solid #999;padding:7px;text-align:left}th{background:#eee}.sign{display:flex;justify-content:space-around;margin-top:80px}.sign div{border-top:1px solid #444;padding-top:8px;text-align:center;width:38%}@media print{button{display:none}}</style><h1>ACTA DE ASIGNACIÓN DE BIENES PATRIMONIALES</h1><p>En Huamancaca Chico, con fecha ${escapeHtml(date)}, se deja constancia de la asignación de bienes municipales a <strong>${escapeHtml(custodian)}</strong>${selectedZone ? `, perteneciente a <strong>${escapeHtml(selectedZone)}</strong>` : ""}.</p><table><thead><tr><th>Código</th><th>Bien</th><th>Zona</th><th>Ambiente</th><th>Cantidad</th><th>Estado</th></tr></thead><tbody>${items}</tbody></table><p>Observaciones: ${escapeHtml(notes || "Sin observaciones.")}</p><p>La persona responsable se compromete al cuidado y uso institucional de los bienes detallados.</p><div class="sign"><div>Entrega<br>Patrimonio</div><div>Recibe<br>${escapeHtml(custodian)}</div></div><script>onload=()=>print()<\/script></html>`);
  popup.document.close();
  assignmentBackdrop.classList.remove("open");
}

function normalizedHeader(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]/g, "");
}

function mapImportedRow(row) {
  const headers = new Map(Object.entries(row).map(([key, value]) => [normalizedHeader(key), value]));
  const aliases = {
    asset_code: ["codigopatrimonial", "assetcode", "codigo"],
    barcode: ["codigodebarras", "barcode", "codigobarras"],
    name: ["nombre", "nombredelbien", "name", "bien"],
    category: ["categoria", "category"],
    quantity: ["cantidad", "quantity"],
    zone: ["zonasecretaria", "zona", "secretaria", "zone"],
    location: ["ambiente", "ambienteubicacion", "ubicacion", "location"],
    custodian: ["responsable", "custodian"],
    condition: ["estado", "estadodeconservacion", "condition"],
    acquired_on: ["fechadeadquisicion", "fecha", "acquired"],
    value: ["valorreferencials", "valor", "value"],
    notes: ["observaciones", "notes"],
    maintenance_due: ["proximomantenimiento", "mantenimientofecha", "maintenancedue"],
    maintenance_notes: ["detallemantenimiento", "mantenimientonotas", "maintenancenotes"]
  };
  const result = {};
  for (const [field, candidates] of Object.entries(aliases)) {
    const match = candidates.find(candidate => headers.has(candidate));
    result[field] = match ? headers.get(match) : "";
  }
  return result;
}

function readImportFile(file) {
  if (!window.XLSX) {
    showToast("No se pudo cargar el lector Excel. Revisa tu conexión e inténtalo de nuevo.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const workbook = window.XLSX.read(reader.result, { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (!rows.length) throw new Error("El archivo no contiene filas de datos.");
      const existingCodes = new Set(assets.map(asset => String(asset.asset_code || "").toLocaleLowerCase("es")));
      const existingBarcodes = new Set(assets.map(asset => String(asset.barcode || "").toLocaleLowerCase("es")).filter(Boolean));
      const seenCodes = new Set();
      const seenBarcodes = new Set();
      importErrors = [];
      importRows = [];
      rows.forEach((source, index) => {
        const values = mapImportedRow(source);
        const rowNumber = index + 2;
        const name = String(values.name ?? "").trim();
        const category = String(values.category ?? "").trim();
        const condition = String(values.condition ?? "Regular").trim() || "Regular";
        const location = String(values.location ?? "").trim();
        const quantity = Number(values.quantity || 1);
        const barcode = String(values.barcode ?? "").trim();
        const code = String(values.asset_code ?? "").trim();
        const errors = [];
        if (!name) errors.push("falta nombre");
        if (!category) errors.push("falta categoría");
        if (!location) errors.push("falta ambiente");
        if (!Number.isInteger(quantity) || quantity < 1) errors.push("cantidad inválida");
        if (!["Bueno", "Regular", "Malo"].includes(condition)) errors.push("estado inválido");
        if (code && (existingCodes.has(code.toLocaleLowerCase("es")) || seenCodes.has(code.toLocaleLowerCase("es")))) errors.push("código patrimonial duplicado");
        if (barcode && (existingBarcodes.has(barcode.toLocaleLowerCase("es")) || seenBarcodes.has(barcode.toLocaleLowerCase("es")))) errors.push("código de barras duplicado");
        if (errors.length) {
          importErrors.push({ row: rowNumber, errors });
          return;
        }
        if (code) seenCodes.add(code.toLocaleLowerCase("es"));
        if (barcode) seenBarcodes.add(barcode.toLocaleLowerCase("es"));
        const acquired = values.acquired_on instanceof Date
          ? values.acquired_on.toISOString().slice(0, 10)
          : String(values.acquired_on ?? "").trim().slice(0, 10);
        importRows.push({
          asset_code: code || undefined,
          barcode: barcode || null,
          name,
          category,
          quantity,
          zone: String(values.zone ?? "").trim(),
          location,
          custodian: String(values.custodian ?? "").trim(),
          condition,
          acquired_on: acquired || null,
          value: Math.max(0, Number(values.value) || 0),
          notes: String(values.notes ?? "").trim().slice(0, 300),
          maintenance_due: String(values.maintenance_due ?? "").trim().slice(0, 10) || null,
          maintenance_notes: String(values.maintenance_notes ?? "").trim().slice(0, 160)
        });
      });
      showImportPreview();
    } catch (error) {
      showToast(`No se pudo leer el archivo: ${error.message}`);
    }
  };
  reader.onerror = () => showToast("No se pudo leer el archivo seleccionado.");
  reader.readAsArrayBuffer(file);
}

function showImportPreview() {
  document.getElementById("importSummary").textContent = `${importRows.length} registros listos para importar · ${importErrors.length} filas omitidas.`;
  document.getElementById("importPreview").innerHTML = `${importErrors.length ? `<div class="import-errors"><strong>Filas que se omitirán:</strong>${importErrors.slice(0, 12).map(item => `<div>Fila ${item.row}: ${escapeHtml(item.errors.join(", "))}</div>`).join("")}${importErrors.length > 12 ? `<div>y ${importErrors.length - 12} filas más</div>` : ""}</div>` : ""}<div class="import-sample">${importRows.slice(0, 8).map(row => `<div><strong>${escapeHtml(row.name)}</strong><span>${escapeHtml(row.zone || "Sin zona")} · ${escapeHtml(row.location)} · ${row.quantity} un.</span></div>`).join("")}${importRows.length > 8 ? `<p>y ${importRows.length - 8} bienes más…</p>` : ""}${importRows.length ? "" : "<p>No hay filas válidas para importar.</p>"}</div>`;
  document.getElementById("confirmImport").disabled = !importRows.length;
  importBackdrop.classList.add("open");
}

async function confirmImportRows() {
  const button = document.getElementById("confirmImport");
  button.disabled = true;
  try {
    if (supabaseReady) {
      const { data, error } = await supabaseClient.from("assets").insert(importRows).select("*");
      if (error) throw error;
      assets = [...data.map(mapDatabaseAsset), ...assets];
    } else {
      let nextNumber = Math.max(0, ...assets.map(item => Number((item.asset_code || item.id).split("-")[1]) || 0));
      const created = importRows.map(row => {
        nextNumber += 1;
        const code = row.asset_code || `HC-${String(nextNumber).padStart(4, "0")}`;
        return { ...row, asset_code: code, id: code, acquired: row.acquired_on || "", created_by: localUserId, attachments: [] };
      });
      assets = [...created, ...assets];
      if (!saveLocalAssets()) throw new Error("No se pudieron guardar los bienes en este navegador.");
      for (const asset of created) addLocalHistory(asset, "created", null, asset);
    }
    importBackdrop.classList.remove("open");
    render();
    if (supabaseReady) await renderRecentHistory();
    showToast(`${importRows.length} bienes importados correctamente.`);
    importRows = [];
    importErrors = [];
    document.getElementById("importFile").value = "";
  } catch (error) {
    showToast(`No se pudo completar la importación: ${error.message}`);
  } finally {
    button.disabled = false;
  }
}
searchInput.addEventListener("input", render);
zoneFilter.addEventListener("change", render);
locationFilter.addEventListener("change", render);
categoryFilter.addEventListener("change", render);
conditionFilter.addEventListener("change", render);
document.getElementById("printReportBtn").addEventListener("click", () => window.print());
document.getElementById("assignmentReportBtn").addEventListener("click", () => {
  document.getElementById("assignmentDate").value = new Date().toISOString().slice(0, 10);
  assignmentBackdrop.classList.add("open");
});
document.getElementById("assignmentForm").addEventListener("submit", printAssignment);
document.getElementById("printQrBtn").addEventListener("click", printQrLabel);
document.getElementById("refreshHistoryBtn").addEventListener("click", renderRecentHistory);
document.getElementById("clearLocationMapBtn").addEventListener("click", () => {
  zoneFilter.value = "";
  locationFilter.value = "";
  render();
});
document.getElementById("locationMap").addEventListener("click", event => {
  const button = event.target.closest("button[data-zone]");
  if (!button) return;
  zoneFilter.value = button.dataset.zone;
  locationFilter.value = button.dataset.location ?? "";
  render();
});
document.getElementById("maintenanceList").addEventListener("click", event => {
  const button = event.target.closest("button[data-action='edit']");
  const asset = assets.find(item => item.id === button?.dataset.id);
  if (asset) openModal(asset);
});
document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change", event => {
  if (event.target.files?.[0]) readImportFile(event.target.files[0]);
});
document.getElementById("confirmImport").addEventListener("click", confirmImportRows);
document.getElementById("refreshUsersBtn").addEventListener("click", loadAdminUsers);
document.getElementById("userRows").addEventListener("click", event => {
  const button = event.target.closest(".user-role-save");
  if (button) saveUserRole(button);
});
document.getElementById("exportBtn").addEventListener("click", () => {
  if (!assets.length) { showToast("No hay bienes para exportar."); return; }
  if (!window.XLSX) { showToast("No se pudo cargar el exportador de Excel. Revisa tu conexión a internet e inténtalo de nuevo."); return; }
  const columns = ["Código patrimonial", "Código de barras", "Nombre", "Categoría", "Cantidad", "Zona / Secretaría", "Ambiente", "Responsable", "Estado", "Fecha de adquisición", "Valor referencial (S/)", "Observaciones"];
  const keys = ["asset_code", "barcode", "name", "category", "quantity", "zone", "location", "custodian", "condition", "acquired", "value", "notes"];
  const rows = [columns, ...assets.map(asset => keys.map(key => asset[key] ?? ""))];
  const workbook = window.XLSX.utils.book_new();
  const worksheet = window.XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 20 }, { wch: 18 }, { wch: 30 }, { wch: 24 }, { wch: 12 }, { wch: 24 }, { wch: 24 }, { wch: 28 }, { wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 40 }];
  window.XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
  window.XLSX.writeFile(workbook, "inventario-patrimonial-huamancaca-chico.xlsx");
  showToast("Inventario exportado a Excel.");
});

async function stopScanner() {
  if (barcodeScanner) {
    try {
      if (barcodeScanner.isScanning) await barcodeScanner.stop();
      await barcodeScanner.clear();
    } catch { /* The camera can already be stopped by the browser. */ }
    barcodeScanner = null;
  }
  scannerBackdrop.classList.remove("open");
}

function onScannedBarcode(code, target) {
  if (target === "form") {
    form.elements.barcode.value = code;
    showToast(`Código leído: ${code}`);
    return;
  }
  const existing = assets.find(asset => asset.barcode === code || asset.asset_code === code);
  let lookupCode = code;
  try {
    const scannedUrl = new URL(code);
    lookupCode = scannedUrl.searchParams.get("asset") || scannedUrl.searchParams.get("code") || code;
  } catch { /* The scanned value is a barcode rather than a URL. */ }
  const match = assets.find(asset => asset.barcode === lookupCode || asset.asset_code === lookupCode);
  searchInput.value = lookupCode;
  categoryFilter.value = "";
  conditionFilter.value = "";
  zoneFilter.value = "";
  locationFilter.value = "";
  if (match || existing) {
    render();
    showToast(`Bien encontrado: ${(match || existing).name}`);
  } else {
    searchInput.value = "";
    render();
    openModal();
    form.elements.barcode.value = code;
    showToast("Código nuevo. Completa los datos para registrarlo.");
  }
}

async function startScanner(target) {
  if (!window.Html5Qrcode) { showToast("No se pudo cargar el lector. Revisa tu conexión a internet."); return; }
  scanTarget = target;
  scanHandled = false;
  scannerBackdrop.classList.add("open");
  document.getElementById("scannerHint").textContent = "Centra el código frente a la cámara. En celulares, permite el acceso cuando el navegador lo solicite.";
  const formats = window.Html5QrcodeSupportedFormats;
  barcodeScanner = new window.Html5Qrcode("barcodeReader", {
    formatsToSupport: [formats.CODE_128, formats.CODE_39, formats.EAN_13, formats.EAN_8, formats.UPC_A, formats.UPC_E, formats.ITF, formats.QR_CODE]
  });
  try {
    await barcodeScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 280, height: 140 } }, async decodedText => {
      if (scanHandled) return;
      scanHandled = true;
      const code = decodedText.trim();
      await stopScanner();
      onScannedBarcode(code, scanTarget);
    }, () => {});
  } catch (error) {
    document.getElementById("scannerHint").textContent = `No se pudo abrir la cámara: ${error.message}. Usa HTTPS y permite el acceso a la cámara.`;
    await stopScanner();
    scannerBackdrop.classList.add("open");
  }
}

document.getElementById("scanLookupBtn").addEventListener("click", () => startScanner("lookup"));
document.getElementById("scanFormBtn").addEventListener("click", () => startScanner("form"));
document.getElementById("closeScanner").addEventListener("click", stopScanner);
scannerBackdrop.addEventListener("click", event => { if (event.target === scannerBackdrop) stopScanner(); });
document.getElementById("closeTransfer").addEventListener("click", closeTransferModal);
document.getElementById("cancelTransfer").addEventListener("click", closeTransferModal);
transferBackdrop.addEventListener("click", event => { if (event.target === transferBackdrop) closeTransferModal(); });
document.getElementById("closeCheck").addEventListener("click", closeCheckModal);
document.getElementById("cancelCheck").addEventListener("click", closeCheckModal);
checkBackdrop.addEventListener("click", event => { if (event.target === checkBackdrop) closeCheckModal(); });
document.getElementById("closeHistory").addEventListener("click", () => historyBackdrop.classList.remove("open"));
historyBackdrop.addEventListener("click", event => { if (event.target === historyBackdrop) historyBackdrop.classList.remove("open"); });
document.getElementById("closeAttachments").addEventListener("click", () => attachmentsBackdrop.classList.remove("open"));
document.getElementById("closeAttachmentsButton").addEventListener("click", () => attachmentsBackdrop.classList.remove("open"));
attachmentsBackdrop.addEventListener("click", event => { if (event.target === attachmentsBackdrop) attachmentsBackdrop.classList.remove("open"); });
document.getElementById("closeQr").addEventListener("click", () => qrBackdrop.classList.remove("open"));
document.getElementById("cancelQr").addEventListener("click", () => qrBackdrop.classList.remove("open"));
qrBackdrop.addEventListener("click", event => { if (event.target === qrBackdrop) qrBackdrop.classList.remove("open"); });
document.getElementById("closeAssignment").addEventListener("click", () => assignmentBackdrop.classList.remove("open"));
document.getElementById("cancelAssignment").addEventListener("click", () => assignmentBackdrop.classList.remove("open"));
assignmentBackdrop.addEventListener("click", event => { if (event.target === assignmentBackdrop) assignmentBackdrop.classList.remove("open"); });
document.getElementById("closeImport").addEventListener("click", () => importBackdrop.classList.remove("open"));
document.getElementById("cancelImport").addEventListener("click", () => importBackdrop.classList.remove("open"));
importBackdrop.addEventListener("click", event => { if (event.target === importBackdrop) importBackdrop.classList.remove("open"); });
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && scannerBackdrop.classList.contains("open")) stopScanner();
  if (event.key === "Escape" && backdrop.classList.contains("open")) closeModal();
  if (event.key === "Escape" && transferBackdrop.classList.contains("open")) closeTransferModal();
  if (event.key === "Escape" && checkBackdrop.classList.contains("open")) closeCheckModal();
  for (const modal of [importBackdrop, historyBackdrop, attachmentsBackdrop, qrBackdrop, assignmentBackdrop]) {
    if (event.key === "Escape" && modal.classList.contains("open")) modal.classList.remove("open");
  }
});

document.getElementById("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const loginButton = document.getElementById("loginBtn");
  loginButton.disabled = true;
  document.getElementById("authError").hidden = true;
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: document.getElementById("loginEmail").value.trim(),
      password: document.getElementById("loginPassword").value
    });
    if (error) showLogin(`No se pudo iniciar sesión: ${error.message}`);
    else if (data.user) await enterWithUser(data.user);
  } catch (error) {
    showLogin(`No se pudo conectar con Supabase: ${error.message}`);
  } finally {
    loginButton.disabled = false;
  }
});

document.getElementById("signOutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut({ scope: "local" });
  assets = [];
  userRole = "user";
  currentUserId = null;
  render();
  showLogin();
});

if (supabaseReady) {
  document.querySelector(".app").hidden = true;
  showLogin();
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      assets = [];
      userRole = "user";
      currentUserId = null;
      render();
      showLogin();
    }
  });
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) showLogin(`No se pudo verificar la sesión: ${error.message}`);
    else if (data.session) enterWithUser(data.session.user);
  });
} else {
  try {
    localUserId = localStorage.getItem(LOCAL_USER_KEY);
    if (!localUserId) {
      localUserId = globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(LOCAL_USER_KEY, localUserId);
    }
    currentUserId = localUserId;
    const saved = localStorage.getItem(STORAGE_KEY);
    assets = saved === null ? structuredClone(sampleAssets) : JSON.parse(saved);
    if (!Array.isArray(assets)) assets = structuredClone(sampleAssets);
    const savedHistory = localStorage.getItem(HISTORY_KEY);
    localHistory = savedHistory ? JSON.parse(savedHistory) : [];
    const savedChecks = localStorage.getItem(CHECKS_KEY);
    assetChecks = new Map(savedChecks ? JSON.parse(savedChecks) : []);
  } catch {
    localUserId = "local-demo";
    currentUserId = localUserId;
    assets = structuredClone(sampleAssets);
  }
  assets = assets.map(asset => ({ ...asset, created_by: asset.created_by || localUserId }));
  render();
  renderRecentHistory();
  openLinkedAsset();
}
