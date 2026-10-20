const config = window.APP_CONFIG ?? {};
const csrfToken = config.csrfToken ?? "";
const canDeleteAssets = Boolean(config.canDelete);

let assets = [];
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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

async function apiRequest(action, payload = null) {
  const options = { headers: { "Accept": "application/json" } };
  let url = `api.php?action=${encodeURIComponent(action)}`;

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

function render() {
  const query = searchInput.value.trim().toLocaleLowerCase("es");
  const filtered = assets.filter(asset => {
    const matchesQuery = [asset.name, asset.asset_code, asset.barcode, asset.location, asset.category, asset.custodian].some(value => String(value ?? "").toLocaleLowerCase("es").includes(query));
    return matchesQuery && (!categoryFilter.value || asset.category === categoryFilter.value) && (!conditionFilter.value || asset.condition === conditionFilter.value);
  });
  rows.innerHTML = filtered.map(asset => `<tr>
    <td><div class="asset-name">${escapeHtml(asset.name)}</div><div class="asset-code">${escapeHtml(asset.asset_code || asset.id)}</div></td>
    <td>${asset.barcode ? `<span class="asset-barcode">${escapeHtml(asset.barcode)}</span>` : "<span class=\"asset-barcode\">Sin código</span>"}</td>
    <td><span class="category-pill">${escapeHtml(asset.category)}</span></td>
    <td>${Number(asset.quantity) || 0}</td>
    <td>${escapeHtml(asset.location)}</td>
    <td>${escapeHtml(asset.custodian || "Sin asignar")}</td>
    <td><span class="status-pill status-${escapeHtml(asset.condition.toLocaleLowerCase("es"))}">${escapeHtml(asset.condition)}</span></td>
    <td><div class="row-actions"><button class="icon-button" type="button" data-action="edit" data-id="${escapeHtml(asset.id)}" aria-label="Editar ${escapeHtml(asset.name)}" title="Editar"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m14 5 5 5M4 20l4.2-.8L19 8.4 15.6 5 4.8 15.8 4 20Z"/></svg></button>${canDeleteAssets ? `<button class="icon-button delete" type="button" data-action="delete" data-id="${escapeHtml(asset.id)}" aria-label="Eliminar ${escapeHtml(asset.name)}" title="Eliminar"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg></button>` : ""}</div></td>
  </tr>`).join("");
  document.getElementById("emptyState").hidden = filtered.length > 0;
  document.querySelector(".table-scroll table").hidden = filtered.length === 0;
  const totalUnits = assets.reduce((total, asset) => total + (Number(asset.quantity) || 0), 0);
  const goodUnits = assets.filter(asset => asset.condition === "Bueno").reduce((total, asset) => total + (Number(asset.quantity) || 0), 0);
  const attentionUnits = assets.filter(asset => asset.condition !== "Bueno").reduce((total, asset) => total + (Number(asset.quantity) || 0), 0);
  const locations = new Set(assets.map(asset => String(asset.location ?? "").trim().toLocaleLowerCase("es")).filter(Boolean));
  document.getElementById("metricItems").textContent = totalUnits.toLocaleString("es-PE");
  document.getElementById("metricGood").textContent = goodUnits.toLocaleString("es-PE");
  document.getElementById("metricAttention").textContent = attentionUnits.toLocaleString("es-PE");
  document.getElementById("metricLocations").textContent = locations.size.toLocaleString("es-PE");
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
  if (asset) {
    for (const key of ["name", "category", "quantity", "condition", "location", "custodian", "acquired", "value", "notes", "barcode"]) form.elements[key].value = asset[key] ?? "";
  }
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
  const payload = {
    name: values.name.trim(),
    category: values.category,
    barcode: values.barcode.trim(),
    quantity: Number(values.quantity),
    location: values.location.trim(),
    custodian: values.custodian.trim(),
    condition: values.condition,
    acquired: values.acquired || "",
    value: Number(values.value) || 0,
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
  if (button.dataset.action === "edit") openModal(asset);
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

document.getElementById("exportBtn").addEventListener("click", () => {
  if (!assets.length) { showToast("No hay bienes para exportar."); return; }
  window.location.href = "export.php";
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
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && scannerBackdrop.classList.contains("open")) stopScanner();
});

loadAssets();

refreshTimer = setInterval(() => {
  if (document.visibilityState === "visible" && !backdrop.classList.contains("open") && !scannerBackdrop.classList.contains("open")) {
    loadAssets(false);
  }
}, 20000);
window.addEventListener("beforeunload", () => clearInterval(refreshTimer));
