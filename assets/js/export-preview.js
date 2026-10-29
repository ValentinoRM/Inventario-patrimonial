(function () {
  const state = {
    csrfToken: "",
    getFiltered: null,
    getAll: null,
    notify: null,
    ready: false
  };

  let backdrop;
  let rows;
  let confirmButton;
  let scopeRadios;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function notify(message) {
    if (typeof state.notify === "function") {
      state.notify(message);
      return;
    }
    window.alert(message);
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(String(value).replace(" ", "T"));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("es-PE");
  }

  function itemsFor(scope) {
    if (scope === "filtered" && typeof state.getFiltered === "function") {
      return state.getFiltered() ?? [];
    }
    return state.getAll() ?? [];
  }

  function totalUnits(items) {
    return items.reduce((total, asset) => total + (Number(asset.quantity) || 0), 0);
  }

  function currentScope() {
    const selected = scopeRadios.find(radio => radio.checked);
    return selected?.value === "filtered" ? "filtered" : "all";
  }

  function renderPreview() {
    const scope = currentScope();
    const items = itemsFor(scope);
    const units = totalUnits(items);

    document.getElementById("exportSummary").textContent = `${items.length} ${items.length === 1 ? "bien" : "bienes"} · ${units} ${units === 1 ? "unidad" : "unidades"}`;
    document.getElementById("exportScopeNote").textContent = scope === "filtered"
      ? "Se exportarán los bienes visibles con los filtros actuales."
      : "Se exportará todo el inventario registrado.";

    confirmButton.disabled = items.length === 0;
    confirmButton.textContent = items.length === 0 ? "Sin bienes para exportar" : "Descargar Excel";

    if (items.length === 0) {
      rows.innerHTML = '<tr><td colspan="10" class="export-empty">No hay bienes para este alcance.</td></tr>';
      return;
    }

    rows.innerHTML = items.map(asset => `<tr>
      <td>${escapeHtml(asset.asset_code)}</td>
      <td>${escapeHtml(asset.barcode || "—")}</td>
      <td>${escapeHtml(asset.name)}</td>
      <td>${escapeHtml(asset.category)}</td>
      <td>${Number(asset.quantity) || 0}</td>
      <td>${escapeHtml(asset.location || "—")}</td>
      <td>${escapeHtml(asset.custodian || "—")}</td>
      <td>${escapeHtml(asset.condition)}</td>
      <td>${escapeHtml(formatDate(asset.acquired))}</td>
      <td>${escapeHtml(asset.notes || "—")}</td>
    </tr>`).join("");
  }

  function refreshCounts() {
    const all = state.getAll() ?? [];
    const filtered = typeof state.getFiltered === "function" ? (state.getFiltered() ?? []) : all;

    document.getElementById("exportFilteredCount").textContent = `${filtered.length} ${filtered.length === 1 ? "registro" : "registros"}`;
    document.getElementById("exportAllCount").textContent = `${all.length} ${all.length === 1 ? "registro" : "registros"}`;
  }

  function open() {
    if (!backdrop) return;

    refreshCounts();
    const filtered = typeof state.getFiltered === "function" ? (state.getFiltered() ?? []) : [];
    const target = filtered.length > 0 ? "filtered" : "all";

    scopeRadios.forEach(radio => { radio.checked = radio.value === target; });
    renderPreview();
    backdrop.classList.add("open");
    confirmButton.focus();
  }

  function close() {
    if (backdrop) backdrop.classList.remove("open");
  }

  async function confirmExport() {
    const scope = currentScope();
    const items = itemsFor(scope);

    if (items.length === 0) {
      notify("No hay bienes para exportar.");
      return;
    }

    const form = document.createElement("form");
    form.method = "post";
    form.action = "export.php";
    form.style.display = "none";

    const token = document.createElement("input");
    token.type = "hidden";
    token.name = "csrf_token";
    token.value = state.csrfToken;
    form.appendChild(token);

    if (scope === "filtered") {
      const ids = document.createElement("input");
      ids.type = "hidden";
      ids.name = "ids";
      ids.value = items.map(asset => Number(asset.id)).filter(id => id > 0).join(",");
      form.appendChild(ids);
    }

    document.body.appendChild(form);
    form.submit();
    setTimeout(() => form.remove(), 1000);
    close();
    notify("Preparando la descarga del Excel.");
  }

  function init(options) {
    state.csrfToken = options?.csrfToken ?? "";
    state.getFiltered = typeof options?.getFiltered === "function" ? options.getFiltered : null;
    state.getAll = typeof options?.getAll === "function" ? options.getAll : () => [];
    state.notify = typeof options?.notify === "function" ? options.notify : null;

    if (state.ready) return;
    backdrop = document.getElementById("exportBackdrop");
    if (!backdrop) return;

    rows = document.getElementById("exportPreviewRows");
    confirmButton = document.getElementById("confirmExport");
    scopeRadios = Array.from(backdrop.querySelectorAll('input[name="exportScope"]'));

    if (!state.getFiltered) {
      const filteredOption = backdrop.querySelector('.export-scope-option input[value="filtered"]')?.closest(".export-scope-option");
      if (filteredOption) filteredOption.hidden = true;
      const allRadio = scopeRadios.find(radio => radio.value === "all");
      if (allRadio) allRadio.checked = true;
    }

    document.getElementById("closeExportModal")?.addEventListener("click", close);
    document.getElementById("cancelExport")?.addEventListener("click", close);
    confirmButton?.addEventListener("click", confirmExport);
    backdrop.addEventListener("click", event => { if (event.target === backdrop) close(); });
    scopeRadios.forEach(radio => radio.addEventListener("change", renderPreview));
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && backdrop.classList.contains("open")) close();
    });

    state.ready = true;
  }

  window.ExportPreview = { init, open };
})();
