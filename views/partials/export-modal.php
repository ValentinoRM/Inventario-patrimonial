  <div class="modal-backdrop" id="exportBackdrop" role="presentation">
    <section class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="exportModalTitle">
      <div class="modal-head"><div><h2 id="exportModalTitle">Vista previa de exportación</h2><p id="exportSubtitle">Revisa los bienes antes de descargar el Excel.</p></div><button class="modal-close" id="closeExportModal" type="button" aria-label="Cerrar">&times;</button></div>

      <div class="export-scope" role="radiogroup" aria-label="Alcance de la exportación">
        <label class="export-scope-option">
          <input type="radio" name="exportScope" value="filtered" checked>
          <span><strong>Bienes filtrados</strong><small id="exportFilteredCount">0 registros</small></span>
        </label>
        <label class="export-scope-option">
          <input type="radio" name="exportScope" value="all">
          <span><strong>Todo el inventario</strong><small id="exportAllCount">0 registros</small></span>
        </label>
      </div>

      <div class="export-summary">
        <span id="exportSummary">0 bienes · 0 unidades</span>
        <span id="exportScopeNote">Se exportarán los bienes visibles con los filtros actuales.</span>
      </div>

      <div class="table-scroll export-preview-scroll">
        <table class="export-preview-table">
          <thead>
            <tr><th>Código</th><th>Barcode</th><th>Nombre</th><th>Categoría</th><th>Cantidad</th><th>Área</th><th>Responsable</th><th>Estado</th><th>Adquisición</th><th>Observaciones</th></tr>
          </thead>
          <tbody id="exportPreviewRows"></tbody>
        </table>
      </div>

      <div class="modal-actions">
        <button class="button button-light" id="cancelExport" type="button">Cancelar</button>
        <button class="button button-primary" id="confirmExport" type="button">Descargar Excel</button>
      </div>
    </section>
  </div>
