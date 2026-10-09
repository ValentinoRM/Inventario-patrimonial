const STORAGE_KEY = "huamancaca-patrimonio-v1";
const sampleAssets = [
  { id: "HC-0001", asset_code: "HC-0001", barcode: "", name: "Computadora de escritorio", category: "Equipos informáticos", quantity: 4, location: "Administración", custodian: "Oficina de administración", condition: "Bueno", acquired: "2024-02-12", value: 3200, notes: "Registro de demostración" },
  { id: "HC-0002", asset_code: "HC-0002", barcode: "", name: "Sillas de oficina", category: "Muebles", quantity: 12, location: "Salón consistorial", custodian: "Secretaría general", condition: "Regular", acquired: "2022-06-18", value: 1800, notes: "Registro de demostración" },
  { id: "HC-0003", asset_code: "HC-0003", barcode: "", name: "Mesas de reunión", category: "Muebles", quantity: 3, location: "Salón consistorial", custodian: "Secretaría general", condition: "Bueno", acquired: "2023-03-07", value: 2100, notes: "Registro de demostración" },
  { id: "HC-0004", asset_code: "HC-0004", barcode: "", name: "Impresora multifuncional", category: "Equipos informáticos", quantity: 2, location: "Tesorería", custodian: "Área de tesorería", condition: "Bueno", acquired: "2024-08-21", value: 2400, notes: "Registro de demostración" },
  { id: "HC-0005", asset_code: "HC-0005", barcode: "", name: "Archivadores metálicos", category: "Muebles", quantity: 5, location: "Archivo central", custodian: "Responsable de archivo", condition: "Regular", acquired: "2021-11-03", value: 1750, notes: "Registro de demostración" },
  { id: "HC-0006", asset_code: "HC-0006", barcode: "", name: "Proyector multimedia", category: "Equipos informáticos", quantity: 1, location: "Desarrollo social", custodian: "Área de desarrollo social", condition: "Malo", acquired: "2020-09-15", value: 1600, notes: "Registro de demostración" }
];

const settings = window.PATRIMONIAL_CONFIG ?? {};
const supabaseReady = Boolean(settings.supabaseUrl && settings.publishableKey && window.supabase?.createClient);
const supabaseClient = supabaseReady ? window.supabase.createClient(settings.supabaseUrl, settings.publishableKey) : null;
let assets = [];
let editingId = null;
let userRole = "user";
let toastTimer;
let realtimeChannel = null;
let barcodeScanner = null;
let scanTarget = "lookup";
let scanHandled = false;

const rows = document.getElementById("assetRows");
const form = document.getElementById("assetForm");
const backdrop = document.getElementById("modalBackdrop");
const scannerBackdrop = document.getElementById("scannerBackdrop");
const categoryFilter = document.getElementById("categoryFilter");
const conditionFilter = document.getElementById("conditionFilter");
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
    location: row.location,
    custodian: row.custodian ?? "",
    condition: row.condition,
    acquired: row.acquired_on ?? "",
    value: Number(row.value) || 0,
    notes: row.notes ?? ""
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
  document.getElementById("databaseStatus").textContent = "Base compartida · cambios sincronizados";
  render();
}

async function enterWithUser(user) {
  userRole = user.app_metadata?.role === "admin" ? "admin" : "user";
  document.getElementById("authScreen").hidden = true;
  document.querySelector(".app").hidden = false;
  document.getElementById("activeUser").textContent = user.email || "Usuario municipal";
  document.getElementById("connectionLabel").textContent = `Sesión municipal · ${userRole === "admin" ? "Administrador" : "Usuario"}`;
  document.getElementById("signOutBtn").hidden = false;
  await loadRemoteAssets();
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
  const canDeleteAssets = !supabaseReady || userRole === "admin";
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
  const current = editingId ? assets.find(asset => asset.id === editingId) : null;
  const payload = {
    name: values.name.trim(),
    category: values.category,
    barcode: values.barcode.trim() || null,
    quantity: Number(values.quantity),
    location: values.location.trim(),
    custodian: values.custodian.trim(),
    condition: values.condition,
    acquired_on: values.acquired || null,
    value: Number(values.value) || 0,
    notes: values.notes.trim()
  };
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
      const localAsset = { ...payload, acquired: payload.acquired_on || "", id: current?.id ?? nextCode, asset_code: current?.asset_code ?? nextCode, barcode: payload.barcode ?? "" };
      delete localAsset.acquired_on;
      if (current) assets = assets.map(item => item.id === editingId ? localAsset : item);
      else assets.unshift(localAsset);
      if (!saveLocalAssets()) return;
    }
    render();
    closeModal();
    showToast(current ? "Cambios guardados." : "Bien registrado correctamente.");
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
  if (button.dataset.action === "delete" && supabaseReady && userRole !== "admin") {
    showToast("Solo un administrador puede eliminar bienes.");
    return;
  }
  if (button.dataset.action === "delete" && confirm(`¿Eliminar "${asset.name}" (${asset.id}) del inventario?`)) {
    try {
      if (supabaseReady) {
        const { error } = await supabaseClient.from("assets").delete().eq("id", asset.id);
        if (error) throw error;
      }
      assets = assets.filter(item => item.id !== asset.id);
      if (!supabaseReady) saveLocalAssets();
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
  if (!window.XLSX) { showToast("No se pudo cargar el exportador de Excel. Revisa tu conexión a internet e inténtalo de nuevo."); return; }
  const columns = ["Código patrimonial", "Código de barras", "Nombre", "Categoría", "Cantidad", "Ambiente", "Responsable", "Estado", "Fecha de adquisición", "Valor referencial (S/)", "Observaciones"];
  const keys = ["asset_code", "barcode", "name", "category", "quantity", "location", "custodian", "condition", "acquired", "value", "notes"];
  const rows = [columns, ...assets.map(asset => keys.map(key => asset[key] ?? ""))];
  const workbook = window.XLSX.utils.book_new();
  const worksheet = window.XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 20 }, { wch: 18 }, { wch: 30 }, { wch: 24 }, { wch: 12 }, { wch: 24 }, { wch: 28 }, { wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 40 }];
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
  if (event.key === "Escape" && backdrop.classList.contains("open")) closeModal();
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
    const saved = localStorage.getItem(STORAGE_KEY);
    assets = saved === null ? structuredClone(sampleAssets) : JSON.parse(saved);
    if (!Array.isArray(assets)) assets = structuredClone(sampleAssets);
  } catch {
    assets = structuredClone(sampleAssets);
  }
  render();
}
