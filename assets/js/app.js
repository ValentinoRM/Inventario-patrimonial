const config = window.APP_CONFIG ?? {};
const csrfToken = config.csrfToken ?? "";
const canEditAssets = Boolean(config.canEdit);
const canDeleteAssets = Boolean(config.canDelete);
const canTransferAssets = Boolean(config.canTransfer);
const isAdmin = Boolean(config.isAdmin);

let assets = [];
let areas = [];
let editingId = null;
let toastTimer;
let barcodeScanner = null;
let scanTarget = "lookup";
let scanHandled = false;
let refreshTimer = null;

const rows = document.getElementById("assetRows");
const form = document.getElementById("assetForm");
const backdrop = document.getElementById("modalBackdrop");
const scannerBackdrop = document.getElementById("scannerBackdrop");
const categoryFilter = document.getElementById("categoryFilter");
const conditionFilter = document.getElementById("conditionFilter");
const searchInput = document.getElementById("searchInput");
const transferBackdrop = document.getElementById("transferBackdrop");
const transferForm = document.getElementById("transferForm");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

async function apiRequest(action, payload = null, query = null) {
  const options = { headers: { "Accept": "application/json" } };
  let url = `api/api.php?action=${encodeURIComponent(action)}`;

  if (query) {
    const params = new URLSearchParams(query);
    url += `&${params.toString()}`;
  }

  if (payload) {
    options.method = "POST";
    options.headers["Content-Type"] = "application/json";
    options.headers["X-CSRF-Token"] = csrfToken;
    options.body = JSON.stringify({ ...payload, action, csrf_token: csrfToken });
  }

  const response = await fetch(url, options);
  let data = {};
  try {
    data = await response.json();
  } catch {
    throw new Error("Respuesta inválida del servidor.");
  }

  if (!response.ok || data.ok === false) {
    if (response.status === 401) {
      window.location.href = "login.php";
      return null;
    }
    throw new Error(data.error || "No se pudo completar la operación.");
  }

  return data;
}

async function loadAssets(showErrors = true) {
  try {
    const data = await apiRequest("list");
    if (!data) return;
    assets = data.assets ?? [];
    document.getElementById("databaseStatus").textContent = "Base compartida municipal · cambios guardados";
    render();
  } catch (error) {
    document.getElementById("databaseStatus").textContent = "Error al conectar con la base de datos";
    if (showErrors) showToast(`No se pudo cargar el inventario: ${error.message}`);
  }
}

async function loadAreas(showErrors = true) {
  try {
    const response = await fetch("api/areas.php?action=list", { headers: { "Accept": "application/json" } });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || "No se pudieron cargar las áreas.");
    }
    areas = data.areas ?? [];
    updateAreaControls();
  } catch (error) {
    if (showErrors) showToast(`No se pudieron cargar las áreas: ${error.message}`);
  }
}

function activeAreas(selectedId = null, excludeId = null) {
  const list = areas.filter(area => area.status === "activo" && Number(area.id) !== Number(excludeId));
  if (selectedId !== null && !list.some(area => Number(area.id) === Number(selectedId))) {
    const current = areas.find(area => Number(area.id) === Number(selectedId));
    if (current) list.push(current);
  }
  return list.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

function fillAreaSelect(select, selectedId = null, excludeId = null, placeholder = "Seleccionar área") {
  if (!select) return;
  const options = activeAreas(selectedId, excludeId);
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` + options.map(area => {
    const suffix = area.status === "inactivo" ? " (inactiva)" : "";
    return `<option value="${escapeHtml(area.id)}">${escapeHtml(area.name + suffix)}</option>`;
  }).join("");
  select.value = selectedId !== null && options.some(area => Number(area.id) === Number(selectedId)) ? String(selectedId) : "";
}

function updateAreaControls() {
  const formArea = document.getElementById("area");
  const selectedArea = editingId ? assets.find(asset => asset.id === editingId)?.area_id ?? null : null;
  fillAreaSelect(formArea, selectedArea);

  const hasActiveAreas = areas.some(area => area.status === "activo");
  const hint = document.getElementById("areaHint");
  if (hint) {
    if (hasActiveAreas) {
      hint.innerHTML = "Selecciona el área donde se ubica el bien.";
    } else {
      hint.innerHTML = isAdmin
        ? 'No hay áreas activas. <a href="areas.php">Crea un área primero</a>.'
        : "No hay áreas activas. Solicita al administrador que registre un área.";
    }
  }
}

function getFilteredAssets() {
  const query = searchInput.value.trim().toLocaleLowerCase("es");
  return assets.filter(asset => {
    const matchesQuery = [asset.name, asset.asset_code, asset.barcode, asset.location, asset.category, asset.custodian].some(value => String(value ?? "").toLocaleLowerCase("es").includes(query));
    return matchesQuery && (!categoryFilter.value || asset.category === categoryFilter.value) && (!conditionFilter.value || asset.condition === conditionFilter.value);
  });
}

function render() {
  const filtered = getFilteredAssets();
  rows.innerHTML = filtered.map(asset => `<tr>
    <td><div class="asset-name">${escapeHtml(asset.name)}</div><div class="asset-code">${escapeHtml(asset.asset_code || asset.id)}</div></td>
    <td>${asset.barcode ? `<span class="asset-barcode">${escapeHtml(asset.barcode)}</span>` : "<span class=\"asset-barcode\">Sin código</span>"}</td>
    <td><span class="category-pill">${escapeHtml(asset.category)}</span></td>
    <td>${Number(asset.quantity) || 0}</td>
    <td>${escapeHtml(asset.location)}</td>
    <td>${escapeHtml(asset.custodian || "Sin asignar")}</td>
    ${isAdmin ? `<td>${escapeHtml(asset.created_by_name || "—")}</td>` : ""}
    <td><span class="status-pill status-${escapeHtml(asset.condition.toLocaleLowerCase("es"))}">${escapeHtml(asset.condition)}</span></td>
    ${isAdmin ? `<td><div class="row-actions">
      ${canEditAssets ? `<button class="icon-button" type="button" data-action="edit" data-id="${escapeHtml(asset.id)}" aria-label="Editar ${escapeHtml(asset.name)}" title="Editar"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m14 5 5 5M4 20l4.2-.8L19 8.4 15.6 5 4.8 15.8 4 20Z"/></svg></button>` : ""}
      ${canTransferAssets ? `<button class="icon-button" type="button" data-action="transfer" data-id="${escapeHtml(asset.id)}" aria-label="Cambiar área de ${escapeHtml(asset.name)}" title="Cambiar área"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 8h13m-4-4 4 4-4 4M20 16H7m4 4-4-4 4-4"/></svg></button>` : ""}
      ${canDeleteAssets ? `<button class="icon-button delete" type="button" data-action="delete" data-id="${escapeHtml(asset.id)}" aria-label="Eliminar ${escapeHtml(asset.name)}" title="Eliminar"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg></button>` : ""}
    </div></td>` : ""}
  </tr>`).join("");
  document.getElementById("emptyState").hidden = filtered.length > 0;
  document.querySelector(".table-scroll table").hidden = filtered.length === 0;
  if (isAdmin) {
    const totalUnits = assets.reduce((total, asset) => total + (Number(asset.quantity) || 0), 0);
    const goodUnits = assets.filter(asset => asset.condition === "Bueno").reduce((total, asset) => total + (Number(asset.quantity) || 0), 0);
    const attentionUnits = assets.filter(asset => asset.condition !== "Bueno").reduce((total, asset) => total + (Number(asset.quantity) || 0), 0);
    const locations = new Set(assets.map(asset => String(asset.location ?? "").trim().toLocaleLowerCase("es")).filter(Boolean));
    document.getElementById("metricItems").textContent = totalUnits.toLocaleString("es-PE");
    document.getElementById("metricGood").textContent = goodUnits.toLocaleString("es-PE");
    document.getElementById("metricAttention").textContent = attentionUnits.toLocaleString("es-PE");
    document.getElementById("metricLocations").textContent = locations.size.toLocaleString("es-PE");
  }
  document.getElementById("resultCount").textContent = `${filtered.length} ${filtered.length === 1 ? "registro" : "registros"}`;
  document.getElementById("tableFootCount").textContent = `${filtered.reduce((total, asset) => total + (Number(asset.quantity) || 0), 0)} bienes`;
  const categories = [...new Set(assets.map(asset => asset.category))].sort((a, b) => a.localeCompare(b, "es"));
  const selected = categoryFilter.value;
  categoryFilter.innerHTML = `<option value="">Todas las categorías</option>${categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}`;
  categoryFilter.value = categories.includes(selected) ? selected : "";
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
  updateAreaControls();
  if (asset) {
    for (const key of ["name", "category", "quantity", "condition", "custodian", "acquired", "notes", "barcode"]) {
      if (form.elements[key] !== undefined) form.elements[key].value = asset[key] ?? "";
    }
    if (form.elements.area_id) form.elements.area_id.value = asset.area_id ? String(asset.area_id) : "";
  }
  backdrop.classList.add("open");
  document.getElementById("name").focus();
}

function closeModal() {
  backdrop.classList.remove("open");
  editingId = null;
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

function renderAreaHistory(movements) {
  const container = document.getElementById("transferHistory");
  if (!container) return;

  if (!movements.length) {
    container.innerHTML = '<span class="muted-note">Sin cambios registrados.</span>';
    return;
  }

  container.innerHTML = movements.slice(0, 6).map(move => `<div class="area-history-item">
    <span class="area-history-route">${escapeHtml(move.from_location)} → ${escapeHtml(move.to_location)}</span>
    <span class="area-history-meta">${escapeHtml(formatDateTime(move.created_at))} · ${escapeHtml(move.moved_by_name || move.moved_by_email || "Sistema")}${move.reason ? ` · ${escapeHtml(move.reason)}` : ""}</span>
  </div>`).join("");
}

async function loadAreaHistory(assetId) {
  const container = document.getElementById("transferHistory");
  if (!container) return;
  container.innerHTML = '<span class="muted-note">Cargando historial...</span>';
  try {
    const data = await apiRequest("movements", null, { asset_id: assetId });
    if (!data) return;
    renderAreaHistory(data.movements ?? []);
  } catch {
    container.innerHTML = '<span class="muted-note">No se pudo cargar el historial.</span>';
  }
}

function openTransferModal(asset) {
  if (!canTransferAssets || !transferForm) return;
  transferForm.reset();
  document.getElementById("transferId").value = asset.id;
  document.getElementById("transferFrom").value = asset.location || "Sin área";
  document.getElementById("transferSubtitle").textContent = `${asset.name} (${asset.asset_code})`;
  fillAreaSelect(document.getElementById("transferArea"), null, asset.area_id, "Seleccionar nueva área");
  transferBackdrop.classList.add("open");
  loadAreaHistory(asset.id);
  document.getElementById("transferArea").focus();
}

function closeTransferModal() {
  if (transferBackdrop) transferBackdrop.classList.remove("open");
}

if (transferForm) {
  transferForm.addEventListener("submit", async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(transferForm).entries());
    const saveButton = document.getElementById("transferSaveBtn");
    saveButton.disabled = true;
    try {
      const result = await apiRequest("transfer", {
        id: Number(values.id),
        area_id: Number(values.area_id),
        reason: values.reason.trim()
      });
      if (!result) return;
      assets = assets.map(item => item.id === Number(values.id) ? result.asset : item);
      render();
      closeTransferModal();
      showToast("Área actualizada correctamente.");
    } catch (error) {
      showToast(`No se pudo cambiar el área: ${error.message}`);
    } finally {
      saveButton.disabled = false;
    }
  });
}

const closeTransferBtn = document.getElementById("closeTransfer");
if (closeTransferBtn) closeTransferBtn.addEventListener("click", closeTransferModal);
const cancelTransferBtn = document.getElementById("cancelTransfer");
if (cancelTransferBtn) cancelTransferBtn.addEventListener("click", closeTransferModal);
if (transferBackdrop) transferBackdrop.addEventListener("click", event => { if (event.target === transferBackdrop) closeTransferModal(); });

document.getElementById("addBtn").addEventListener("click", () => openModal());
document.getElementById("closeModal").addEventListener("click", closeModal);
document.getElementById("cancelModal").addEventListener("click", closeModal);
backdrop.addEventListener("click", event => { if (event.target === backdrop) closeModal(); });
document.addEventListener("keydown", event => { if (event.key === "Escape" && backdrop.classList.contains("open")) closeModal(); if (event.key === "Escape") closeTransferModal(); });

form.addEventListener("submit", async event => {
  event.preventDefault();
  const data = new FormData(form);
  const values = Object.fromEntries(data.entries());
  const payload = {
    name: values.name.trim(),
    category: values.category,
    barcode: values.barcode.trim(),
    quantity: Number(values.quantity),
    area_id: Number(values.area_id),
    custodian: values.custodian.trim(),
    condition: values.condition,
    acquired: values.acquired || "",
    notes: values.notes.trim()
  };
  const saveButton = document.getElementById("saveBtn");
  saveButton.disabled = true;
  try {
    if (editingId) {
      const result = await apiRequest("update", { id: editingId, ...payload });
      if (!result) return;
      assets = assets.map(item => item.id === editingId ? result.asset : item);
      showToast("Cambios guardados.");
    } else {
      const result = await apiRequest("create", payload);
      if (!result) return;
      assets.unshift(result.asset);
      showToast("Bien registrado correctamente.");
    }
    render();
    closeModal();
  } catch (error) {
    showToast(`No se pudo guardar: ${error.message}`);
  } finally {
    saveButton.disabled = false;
  }
});

rows.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const asset = assets.find(item => item.id === Number(button.dataset.id));
  if (!asset) return;
  if (button.dataset.action === "edit") { if (canEditAssets) openModal(asset); else showToast("Solo el administrador puede editar bienes."); }
  if (button.dataset.action === "transfer") { openTransferModal(asset); }
  if (button.dataset.action === "delete" && confirm(`¿Eliminar "${asset.name}" (${asset.asset_code}) del inventario?`)) {
    try {
      await apiRequest("delete", { id: asset.id });
      assets = assets.filter(item => item.id !== asset.id);
      render();
      showToast("Bien eliminado del inventario.");
    } catch (error) {
      showToast(`No se pudo eliminar: ${error.message}`);
    }
  }
});

searchInput.addEventListener("input", render);
categoryFilter.addEventListener("change", render);
conditionFilter.addEventListener("change", render);

const exportBtn = document.getElementById("exportBtn");
if (exportBtn) {
  exportBtn.addEventListener("click", () => {
    if (!assets.length) { showToast("No hay bienes para exportar."); return; }
    if (window.ExportPreview) {
      window.ExportPreview.open();
    } else {
      window.location.href = "export.php";
    }
  });
}

if (window.ExportPreview) {
  window.ExportPreview.init({
    csrfToken,
    getFiltered: getFilteredAssets,
    getAll: () => assets,
    notify: showToast
  });
}

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
  searchInput.value = code;
  categoryFilter.value = "";
  conditionFilter.value = "";
  if (existing) {
    render();
    showToast(`Bien encontrado: ${existing.name}`);
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
  const scannerHint = document.getElementById("scannerHint");
  scannerHint.textContent = "Centra el código frente a la cámara. En celulares, permite el acceso cuando el navegador lo solicite.";
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
    const reason = error instanceof Error ? error.message : String(error || "el navegador no dio más detalles");
    scannerHint.textContent = `No se pudo abrir la cámara (${reason}). Usa HTTPS y permite el acceso a la cámara.`;
    await stopScanner();
    scannerBackdrop.classList.add("open");
  }
}

const scanLookupBtn = document.getElementById("scanLookupBtn");
if (scanLookupBtn) scanLookupBtn.addEventListener("click", () => startScanner("lookup"));
document.getElementById("scanFormBtn").addEventListener("click", () => startScanner("form"));
document.getElementById("closeScanner").addEventListener("click", stopScanner);
scannerBackdrop.addEventListener("click", event => { if (event.target === scannerBackdrop) stopScanner(); });
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && scannerBackdrop.classList.contains("open")) stopScanner();
});

async function initInventory() {
  await loadAreas();
  await loadAssets();
}

initInventory();

refreshTimer = setInterval(() => {
  const exportBackdrop = document.getElementById("exportBackdrop");
  if (document.visibilityState === "visible"
    && !backdrop.classList.contains("open")
    && !(transferBackdrop && transferBackdrop.classList.contains("open"))
    && !scannerBackdrop.classList.contains("open")
    && !(exportBackdrop && exportBackdrop.classList.contains("open"))) {
    loadAreas(false);
    loadAssets(false);
  }
}, 20000);
window.addEventListener("beforeunload", () => clearInterval(refreshTimer));
