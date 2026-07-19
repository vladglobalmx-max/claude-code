import type { Project } from "@impulso/document-schema";
import { createIndexedDbAssetStore, type AssetBinaryStore } from "@impulso/asset-library";
import { createIndexedDbTemplateStore, type TemplateStore } from "@impulso/template-library";
import { createIndexedDbProjectStore, type ProjectStore } from "@impulso/project-library";
import { mountApp, MODULE_ID, type App, type AppElements } from "./app.js";
import { mountWorkspace, type Workspace } from "./workspace.js";
import { migrateLegacyLocalProject } from "./workspaceMigration.js";

export interface ShellElements {
  workspaceScreen: HTMLElement;
  workspaceContainer: HTMLElement;
  editorScreen: HTMLElement;
  editor: AppElements;
}

export interface MountShellOptions {
  elements: ShellElements;
  binaryStore?: AssetBinaryStore;
  templateStore?: TemplateStore;
  projectStore?: ProjectStore;
  generateThumbnail?: (project: Project) => Promise<Blob>;
  /** Inyectable para tests; por defecto `localStorage` real — de dónde
   * migra `migrateLegacyLocalProject` (ver ADR-0014). */
  storage?: Storage;
  keyboardTarget?: EventTarget;
  now?: () => string;
  generateId?: () => string;
}

export interface Shell {
  destroy(): void;
}

/**
 * Punto de entrada real de la app (Workspace-first, ver ADR-0014): aterriza
 * en "Mis proyectos" (`workspace.ts`) y solo monta el editor (`app.ts`)
 * cuando el usuario abre o crea un proyecto. Antes de mostrar nada, corre
 * la migración transparente y de una sola vez del slot único legado de
 * `localStorage` (ADR-0009) hacia el `ProjectStore` nuevo.
 *
 * Abrir un proyecto distinto SIEMPRE destruye la instancia de `App`
 * anterior (si la había) antes de montar una nueva — nunca hay dos
 * editores vivos a la vez, mismo criterio de "destruir y remontar" que
 * `app.ts` ya usa internamente para "Nuevo"/"Abrir" desde ADR-0009.
 */
export function mountShell(options: MountShellOptions): Shell {
  const binaryStore = options.binaryStore ?? createIndexedDbAssetStore();
  const templateStore = options.templateStore ?? createIndexedDbTemplateStore();
  const projectStore = options.projectStore ?? createIndexedDbProjectStore();
  const now = options.now ?? (() => new Date().toISOString());
  const generateId = options.generateId ?? (() => crypto.randomUUID());
  const { workspaceScreen, workspaceContainer, editorScreen, editor } = options.elements;

  let currentApp: App | null = null;

  function showWorkspace(): void {
    editorScreen.style.display = "none";
    workspaceScreen.style.display = "";
    void workspace.refresh();
  }

  function showEditor(): void {
    workspaceScreen.style.display = "none";
    editorScreen.style.display = "";
  }

  function openEditor(project: Project): void {
    currentApp?.destroy();
    showEditor();
    currentApp = mountApp({
      elements: editor,
      binaryStore,
      templateStore,
      projectStore,
      generateThumbnail: options.generateThumbnail,
      initialProject: project,
      now,
      generateId,
      keyboardTarget: options.keyboardTarget,
      onBackToWorkspace: () => {
        currentApp?.destroy();
        currentApp = null;
        showWorkspace();
      },
    });
  }

  const workspace: Workspace = mountWorkspace(workspaceContainer, {
    projectStore,
    templateStore,
    moduleId: MODULE_ID,
    now,
    generateId,
    onOpenProject: openEditor,
  });

  showWorkspace();

  void migrateLegacyLocalProject(projectStore, binaryStore, { storage: options.storage, now, generateId }).then((result) => {
    if (result.migrated) void workspace.refresh();
  });

  return {
    destroy: () => {
      currentApp?.destroy();
      workspace.destroy();
    },
  };
}
