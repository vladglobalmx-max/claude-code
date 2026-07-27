import type { Project, ProjectId } from "@impulso/document-schema";
import { cloneProjectWithNewIds } from "@impulso/engine";
import { duplicateProject, type ProjectDescriptor, type ProjectRecoveryEntry, type ProjectStore } from "@impulso/project-library";
import type { TemplateStore } from "@impulso/template-library";
import type { AssetBinaryStore } from "@impulso/asset-library";
import { triggerBrowserDownload, sanitizeFilename } from "@impulso/export-engine";
import { mountNewProjectDialog, type NewProjectDialog } from "./newProjectDialog.js";
import { createLazyBuiltInTemplateSeeder } from "./builtInTemplates.js";
import { createThumbnailGenerator } from "./app.js";
import { importProjectBackup, serializeProjectBackup, ProjectBackupError } from "./projectBackup.js";
import { mountWelcomeDialog, type WelcomeDialog } from "./welcomeDialog.js";
import { getCommercialManifest } from "./commercialManifest.js";

export interface Workspace {
  refresh(): Promise<void>;
  destroy(): void;
}

export interface MountWorkspaceOptions {
  projectStore: ProjectStore;
  templateStore: TemplateStore;
  /** Fase 4.2 — necesario para que "Exportar respaldo"/"Importar proyecto"
   * incluyan los binarios de los assets referenciados, no solo el
   * `Project` (ver `projectBackup.ts`). */
  assetStore: AssetBinaryStore;
  /** Qué módulo filtrar — "sticker-builder" hoy; cualquier módulo futuro
   * monta su propia Workspace pasando el suyo (ver ADR-0014). */
  moduleId: string;
  /** Se llama cuando el usuario elige abrir o crear un proyecto — la app
   * decide qué hacer con él (montar el editor). `meta.isNew` distingue
   * abrir un Project EXISTENTE (`isNew: false`, ver `handleOpen`) de crear
   * uno nuevo/desde Template (`isNew: true`, ver `newProjectDialog.onCreate`
   * más abajo) — Epic 8, sección 3: solo el segundo caso debe arrancar el
   * `ProjectSaveCoordinator` del editor en `"dirty"`. */
  onOpenProject: (project: Project, meta?: { isNew?: boolean }) => void;
  now?: () => string;
  generateId?: () => string;
  /** Genera el thumbnail de un proyecto recién importado desde un respaldo
   * (ver `handleImportBackup` más abajo) — inyectable para evitar la
   * rasterización real de Konva en tests (jsdom no implementa
   * `HTMLCanvasElement.toBlob`), mismo criterio que `AppDependencies.
   * generateThumbnail` en `app.ts`. Por defecto `createThumbnailGenerator(...)`
   * resolviendo binarios desde `assetStore`. */
  generateThumbnail?: (project: Project) => Promise<Blob>;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

/**
 * "Mis proyectos": pantalla de aterrizaje de la app (Workspace-first, ver
 * ADR-0014) — grilla de proyectos guardados con Abrir/Renombrar/Duplicar
 * proyecto/Eliminar, ordenada por última edición. "Nuevo proyecto" reutiliza
 * la galería de Templates ya existente (`newProjectDialog.ts`, Epic 4) tal
 * cual, montada en su propio contenedor con su propio callback `onCreate`.
 *
 * "Duplicar proyecto" es un nombre deliberadamente distinto del botón
 * "Duplicar" del editor (que duplica un *object* seleccionado dentro del
 * canvas) — acciones completamente distintas que conviven en la misma app.
 */
export function mountWorkspace(container: HTMLElement, options: MountWorkspaceOptions): Workspace {
  const now = options.now ?? (() => new Date().toISOString());
  const generateId = options.generateId ?? (() => crypto.randomUUID());
  const generateThumbnail = options.generateThumbnail ?? createThumbnailGenerator({ resolve: (assetId) => options.assetStore.get(assetId) });

  const root = document.createElement("div");
  root.className = "workspace-screen";

  // Brand Integration — THÖREN: única marca visible en la interfaz (ver
  // propuesta de sistema visual aprobada). Elemento propio, aditivo, fuera
  // del layout flex de `.workspace-header` — no reestructura ningún nodo
  // existente ni su distribución (space-between).
  const brandMark = document.createElement("div");
  brandMark.className = "brand-mark";
  brandMark.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="23" y="11" width="7" height="42" rx="3.5" fill="currentColor"/><path d="M30 22 C40 22 45 27 45 32 C45 37 40 42 30 42" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/></svg><span>THÖREN</span>`;
  root.appendChild(brandMark);

  const header = document.createElement("div");
  header.className = "workspace-header";

  const title = document.createElement("h1");
  title.textContent = "Mis proyectos";
  header.appendChild(title);

  const newButton = document.createElement("button");
  newButton.type = "button";
  newButton.className = "workspace-new-btn";
  newButton.textContent = "Nuevo proyecto";
  header.appendChild(newButton);

  // Fase 4.2, sección 18 (Backup y portabilidad): único punto de entrada
  // para restaurar un respaldo — abre el selector de archivo nativo, sin
  // ningún backend ni sincronización remota.
  const importButton = document.createElement("button");
  importButton.type = "button";
  importButton.className = "workspace-import-btn";
  importButton.textContent = "Importar proyecto";
  const importInput = document.createElement("input");
  importInput.type = "file";
  importInput.accept = ".json,application/json";
  importInput.style.display = "none";
  importButton.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", () => {
    const file = importInput.files?.[0];
    importInput.value = "";
    if (file) void handleImportBackup(file);
  });
  header.appendChild(importButton);
  header.appendChild(importInput);
  root.appendChild(header);

  // Fase 4.2, sección 13 ("Estado comercial en la app"): discreto, lenguaje
  // honesto — nunca "activado" (no existe activación técnica en V1,
  // licensingMode: "delivery-only", ver ADR-0028).
  const { manifest: commercialManifest } = getCommercialManifest();
  if (commercialManifest) {
    const commercialStatus = document.createElement("p");
    commercialStatus.className = "workspace-commercial-status";
    // `channel` es un identificador de manifest en minúsculas (ej. "gumroad")
    // — se capitaliza solo para mostrarlo, nunca se toca el valor real del
    // manifest. Encontrado durante la revisión de branding de RC1 (se veía
    // "gumroad" en minúscula en un texto por lo demás bien puntuado).
    const channelDisplayName =
      commercialManifest.channel.charAt(0).toUpperCase() + commercialManifest.channel.slice(1);
    commercialStatus.textContent = `${commercialManifest.branding.displayName} · Versión ${commercialManifest.productVersion} · Edición comercial (pago único) · Distribuido mediante ${channelDisplayName}`;
    root.appendChild(commercialStatus);
  }

  const welcomeDialogContainer = document.createElement("div");
  root.appendChild(welcomeDialogContainer);
  const welcomeDialog: WelcomeDialog = mountWelcomeDialog(welcomeDialogContainer, { manifest: commercialManifest });

  const errorMessage = document.createElement("p");
  errorMessage.className = "workspace-error";
  errorMessage.style.display = "none";
  root.appendChild(errorMessage);

  const emptyMessage = document.createElement("p");
  emptyMessage.className = "workspace-empty";
  emptyMessage.textContent = "Todavía no tienes proyectos guardados. Crea uno para empezar.";
  emptyMessage.style.display = "none";
  root.appendChild(emptyMessage);

  // Epic 8 — Autosave, Recovery & Project Safety, sección 10/11: cambios
  // detectados en `projectRecovery` más recientes que la última versión
  // guardada (o de un Project que nunca llegó a persistirse) — nunca se
  // sobreescriben en automático, se ofrece explícitamente elegir.
  const recoveryBanner = document.createElement("div");
  recoveryBanner.className = "workspace-recovery-banner";
  recoveryBanner.style.display = "none";
  root.appendChild(recoveryBanner);

  const grid = document.createElement("div");
  grid.className = "workspace-grid";
  root.appendChild(grid);

  const newProjectDialogContainer = document.createElement("div");
  root.appendChild(newProjectDialogContainer);

  container.appendChild(root);

  let objectUrls: string[] = [];
  function revokeObjectUrls(): void {
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls = [];
  }

  function handleOpen(id: ProjectId): void {
    void options.projectStore.getProject(id).then((project) => {
      if (project) options.onOpenProject(project, { isNew: false });
    });
  }

  async function handleRename(id: ProjectId, newName: string): Promise<void> {
    const trimmed = newName.trim();
    if (!trimmed) {
      await refresh();
      return;
    }
    const project = await options.projectStore.getProject(id);
    if (!project) return;
    await options.projectStore.save({ ...project, metadata: { ...project.metadata, name: trimmed, updatedAt: now() } });
    await refresh();
  }

  function handleDuplicate(id: ProjectId): void {
    void duplicateProject(options.projectStore, id, { now: now(), generateId }).then(() => refresh());
  }

  function handleDelete(id: ProjectId, name: string): void {
    if (!window.confirm(`¿Eliminar el proyecto "${name}"? Esta acción no se puede deshacer.`)) return;
    void options.projectStore.delete(id).then(() => refresh());
  }

  /**
   * Fase 4.2, sección 18: respaldo autocontenido (Project + binarios de sus
   * assets) — ver `projectBackup.ts`. Es la vía recomendada antes de una
   * actualización manual (nueva descarga, posible cambio de origen de
   * IndexedDB, ver ADR-0028).
   */
  async function handleExportBackup(id: ProjectId, name: string): Promise<void> {
    const project = await options.projectStore.getProject(id);
    if (!project) return;
    const raw = await serializeProjectBackup(project, options.assetStore, now);
    const blob = new Blob([raw], { type: "application/json" });
    const filename = `${sanitizeFilename(name)}-respaldo-impulso.json`;
    triggerBrowserDownload(blob, filename);
  }

  function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo."));
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(file);
    });
  }

  async function handleImportBackup(file: File): Promise<void> {
    const raw = await readFileAsText(file);
    let imported;
    try {
      imported = await importProjectBackup(raw, options.assetStore);
    } catch (error) {
      const message = error instanceof ProjectBackupError ? error.message : "No se pudo leer el archivo de respaldo.";
      window.alert(message);
      return;
    }
    // Bug real encontrado en la validación de Release Candidate 1.0:
    // guardar `imported.project` tal cual (mismo id que el original)
    // sobrescribía en silencio un proyecto ya existente en vez de agregar
    // uno nuevo — solo se notaba al re-importar un respaldo en el MISMO
    // navegador donde el proyecto original seguía existiendo (justo el
    // caso más común: un comprador probando que su respaldo "sí funciona").
    // `cloneProjectWithNewIds` (mismo mecanismo que ya usa "Duplicar
    // proyecto", @impulso/engine) garantiza que importar SIEMPRE crea una
    // entrada nueva e independiente, sin importar si el proyecto original
    // sigue presente.
    const freshProject = cloneProjectWithNewIds(imported.project, { now: now(), generateId });
    // Bug real encontrado en la validación de comprador en vivo de RC1: un
    // proyecto recién importado se guardaba SIN thumbnail (nunca se
    // generaba uno) — su tarjeta en "Mis proyectos" quedaba con el ícono de
    // imagen rota hasta que el comprador lo abría y guardaba manualmente al
    // menos una vez. Un fallo generando el thumbnail nunca debe impedir que
    // el respaldo se importe (mismo criterio que `persistProject` en
    // `app.ts`) — solo se pierde la miniatura, no el proyecto.
    let importThumbnail: Blob | undefined;
    try {
      importThumbnail = await generateThumbnail(freshProject);
    } catch (error) {
      console.error("No se pudo generar la miniatura del proyecto importado:", error);
    }
    await options.projectStore.save(freshProject, importThumbnail);
    if (imported.missingAssetIds.length > 0) {
      window.alert(
        `El proyecto se importó, pero ${imported.missingAssetIds.length} asset(s) ya faltaban en el respaldo y no pudieron restaurarse.`,
      );
    }
    await refresh();
  }

  function startRename(nameSpan: HTMLElement, descriptor: ProjectDescriptor): void {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "workspace-card-name-input";
    input.value = descriptor.name;
    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    let settled = false;
    function commit(): void {
      if (settled) return;
      settled = true;
      void handleRename(descriptor.id, input.value);
    }
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        commit();
      } else if (evt.key === "Escape") {
        settled = true;
        void refresh();
      }
    });
  }

  function buildCard(descriptor: ProjectDescriptor): HTMLElement {
    const card = document.createElement("div");
    card.className = "workspace-card";

    const thumbnail = document.createElement("img");
    thumbnail.className = "workspace-card-thumbnail";
    thumbnail.alt = descriptor.name;
    if (descriptor.thumbnail) {
      const url = URL.createObjectURL(descriptor.thumbnail);
      objectUrls.push(url);
      thumbnail.src = url;
    }
    thumbnail.addEventListener("click", () => handleOpen(descriptor.id));
    card.appendChild(thumbnail);

    const nameRow = document.createElement("div");
    nameRow.className = "workspace-card-name-row";
    const name = document.createElement("span");
    name.className = "workspace-card-name";
    name.textContent = descriptor.name;
    name.addEventListener("click", () => handleOpen(descriptor.id));
    nameRow.appendChild(name);

    const renameButton = document.createElement("button");
    renameButton.type = "button";
    renameButton.className = "workspace-card-rename";
    renameButton.title = "Renombrar";
    renameButton.textContent = "✏️";
    renameButton.addEventListener("click", (evt) => {
      evt.stopPropagation();
      startRename(name, descriptor);
    });
    nameRow.appendChild(renameButton);
    card.appendChild(nameRow);

    const updated = document.createElement("span");
    updated.className = "workspace-card-updated";
    updated.textContent = `Editado ${formatDate(descriptor.updatedAt)}`;
    card.appendChild(updated);

    const actions = document.createElement("div");
    actions.className = "workspace-card-actions";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "workspace-card-open";
    openButton.textContent = "Abrir";
    openButton.addEventListener("click", () => handleOpen(descriptor.id));
    actions.appendChild(openButton);

    const duplicateButton = document.createElement("button");
    duplicateButton.type = "button";
    duplicateButton.className = "workspace-card-duplicate";
    duplicateButton.textContent = "Duplicar proyecto";
    duplicateButton.addEventListener("click", () => handleDuplicate(descriptor.id));
    actions.appendChild(duplicateButton);

    const exportBackupButton = document.createElement("button");
    exportBackupButton.type = "button";
    exportBackupButton.className = "workspace-card-export-backup";
    exportBackupButton.title = "Descarga el proyecto y sus assets en un solo archivo, para restaurarlo si actualizas o cambias de equipo";
    exportBackupButton.textContent = "Exportar respaldo";
    exportBackupButton.addEventListener("click", () => void handleExportBackup(descriptor.id, descriptor.name));
    actions.appendChild(exportBackupButton);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "workspace-card-delete";
    deleteButton.textContent = "Eliminar";
    deleteButton.addEventListener("click", () => handleDelete(descriptor.id, descriptor.name));
    actions.appendChild(deleteButton);

    card.appendChild(actions);
    return card;
  }

  /**
   * Fila de una recovery pendiente: "Recuperar cambios" abre el editor con
   * el contenido recuperado (SIEMPRE `isNew: true` — su revisión difiere de
   * lo persistido, o no hay nada persistido todavía; en ambos casos el
   * `ProjectSaveCoordinator` debe arrancar en `"dirty"` para autosavearlo
   * pronto). "Abrir versión guardada" solo existe si de verdad hay una
   * (Project con descriptor) y descarta la recovery al elegirla — de otro
   * modo el banner reaparecería cada vez. "Descartar" simplemente limpia la
   * recovery sin abrir nada.
   */
  function buildRecoveryRow(recovery: ProjectRecoveryEntry, descriptor: ProjectDescriptor | undefined): HTMLElement {
    const row = document.createElement("div");
    row.className = "workspace-recovery-row";

    const name = descriptor?.name ?? recovery.project.metadata.name ?? "Proyecto sin guardar";
    const text = document.createElement("span");
    text.className = "workspace-recovery-text";
    text.textContent = `"${name}": hay cambios sin guardar de ${formatDate(recovery.savedAt)}.`;
    row.appendChild(text);

    const actions = document.createElement("div");
    actions.className = "workspace-recovery-actions";

    const recoverButton = document.createElement("button");
    recoverButton.type = "button";
    recoverButton.className = "workspace-recovery-recover";
    recoverButton.textContent = "Recuperar cambios";
    recoverButton.addEventListener("click", () => {
      options.onOpenProject(recovery.project, { isNew: true });
    });
    actions.appendChild(recoverButton);

    if (descriptor) {
      const openSavedButton = document.createElement("button");
      openSavedButton.type = "button";
      openSavedButton.className = "workspace-recovery-open-saved";
      openSavedButton.textContent = "Abrir versión guardada";
      openSavedButton.addEventListener("click", () => {
        void options.projectStore
          .clearRecovery(recovery.projectId)
          .then(() => options.projectStore.getProject(recovery.projectId))
          .then((saved) => {
            if (saved) options.onOpenProject(saved, { isNew: false });
            return refresh();
          });
      });
      actions.appendChild(openSavedButton);
    }

    const discardButton = document.createElement("button");
    discardButton.type = "button";
    discardButton.className = "workspace-recovery-discard";
    discardButton.textContent = "Descartar";
    discardButton.addEventListener("click", () => {
      void options.projectStore.clearRecovery(recovery.projectId).then(() => refresh());
    });
    actions.appendChild(discardButton);

    row.appendChild(actions);
    return row;
  }

  async function refreshRecoveryBanner(): Promise<void> {
    recoveryBanner.innerHTML = "";

    let recoveries: ProjectRecoveryEntry[];
    try {
      recoveries = await options.projectStore.listRecoveries();
    } catch {
      // No molestar con un banner de recovery si ni siquiera se puede
      // listarla — el error real de carga ya se refleja en `errorMessage`.
      recoveryBanner.style.display = "none";
      return;
    }

    for (const recovery of recoveries) {
      let descriptor: ProjectDescriptor | undefined;
      try {
        descriptor = await options.projectStore.getDescriptor(recovery.projectId);
      } catch {
        descriptor = undefined;
      }
      if (descriptor && descriptor.updatedAt >= recovery.savedAt) {
        // Ya quedó obsoleta por un guardado real posterior — se limpia en
        // silencio, nunca se acumula (sección 10: "nunca acumular
        // snapshots indefinidamente").
        await options.projectStore.clearRecovery(recovery.projectId).catch(() => undefined);
        continue;
      }
      recoveryBanner.appendChild(buildRecoveryRow(recovery, descriptor));
    }

    recoveryBanner.style.display = recoveryBanner.children.length > 0 ? "" : "none";
  }

  async function doRefresh(): Promise<void> {
    grid.innerHTML = "";
    revokeObjectUrls();
    errorMessage.style.display = "none";

    let descriptors: ProjectDescriptor[];
    try {
      descriptors = await options.projectStore.listDescriptors({ moduleId: options.moduleId });
    } catch (error) {
      errorMessage.textContent = `No se pudieron cargar tus proyectos: ${(error as Error).message}`;
      errorMessage.style.display = "block";
      descriptors = [];
    }

    descriptors.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    emptyMessage.style.display = descriptors.length === 0 ? "block" : "none";

    for (const descriptor of descriptors) {
      grid.appendChild(buildCard(descriptor));
    }

    await refreshRecoveryBanner();
  }

  // `mountWorkspace` dispara su propio `refresh()` inicial (más abajo) Y
  // `shell.ts` dispara OTRO justo después de montar (`showWorkspace()`) —
  // sin este guardado de "único vuelo", ambas llamadas se solapan: cada
  // una limpia `grid`/`recoveryBanner` y vuelve a poblarlos de forma
  // independiente, duplicando tarjetas/filas de recovery (visto en la
  // práctica: Epic 8, el banner de recovery mostraba 2 filas idénticas
  // para un único Project). Mismo patrón que `ProjectSaveCoordinator`:
  // una llamada concurrente espera la MISMA ejecución en curso en vez de
  // iniciar una segunda.
  let refreshInFlight: Promise<void> | undefined;
  function refresh(): Promise<void> {
    if (!refreshInFlight) {
      refreshInFlight = doRefresh().finally(() => {
        refreshInFlight = undefined;
      });
    }
    return refreshInFlight;
  }

  const newProjectDialog: NewProjectDialog = mountNewProjectDialog(newProjectDialogContainer, {
    templateStore: options.templateStore,
    moduleId: options.moduleId,
    now,
    generateId,
    onCreate: (project) => options.onOpenProject(project, { isNew: true }),
  });

  // Propia instancia del sembrado perezoso de built-in — el botón "Nuevo
  // proyecto" de la Workspace es, desde esta épica, el punto de entrada
  // primario para crear un proyecto (ver ADR-0014); `app.ts` mantiene la
  // suya propia para su botón "Nuevo" interno del editor. Ambas son
  // inofensivamente redundantes: `seedBuiltInTemplates` es idempotente.
  const builtInTemplatesSeeder = createLazyBuiltInTemplateSeeder(options.templateStore, {
    now,
    generateThumbnail: createThumbnailGenerator({ resolve: () => Promise.resolve(undefined) }),
  });
  newButton.addEventListener("click", () => {
    void builtInTemplatesSeeder.ensureSeeded().then(() => newProjectDialog.open());
  });

  void refresh();
  welcomeDialog.showIfFirstRun();

  return {
    refresh,
    destroy: () => {
      revokeObjectUrls();
      newProjectDialog.destroy();
      welcomeDialog.destroy();
      root.remove();
    },
  };
}
