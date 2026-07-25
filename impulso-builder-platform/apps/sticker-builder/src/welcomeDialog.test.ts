import { afterEach, describe, expect, it } from "vitest";
import type { ProductManifest } from "@impulso/commercial-schema";
import { hasSeenWelcome, markWelcomeSeen, mountWelcomeDialog } from "./welcomeDialog.js";

function fakeManifest(overrides: Partial<ProductManifest> = {}): ProductManifest {
  return {
    schemaVersion: 1,
    productId: "impulso-sticker-builder",
    slug: "sticker-builder",
    productVersion: "1.0.0",
    edition: "professional",
    modules: ["sticker-builder"],
    capabilities: [],
    branding: { displayName: "Impulso Sticker Builder Professional", shortName: "Impulso Sticker Builder" },
    support: { email: "soporte@example.com", docsUrl: null },
    updateChannel: "stable",
    licensingMode: "delivery-only",
    channel: "gumroad",
    termsReference: null,
    legal: { eulaPath: null, privacyPath: null, thirdPartyLicensesPath: null },
    buildMetadata: { builtAt: null, commit: null, buildId: null },
    releaseMetadata: { releaseDate: null, releaseNotesPath: null },
    ...overrides,
  };
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
  } as Storage;
}

function container(): HTMLDivElement {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

describe("hasSeenWelcome / markWelcomeSeen", () => {
  it("hasSeenWelcome es false hasta que se llama a markWelcomeSeen", () => {
    const storage = memoryStorage();
    expect(hasSeenWelcome(storage)).toBe(false);
    markWelcomeSeen(storage);
    expect(hasSeenWelcome(storage)).toBe(true);
  });

  it("degrada a false (nunca lanza) si storage.getItem lanza", () => {
    const throwing: Pick<Storage, "getItem"> = {
      getItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(hasSeenWelcome(throwing)).toBe(false);
  });

  it("markWelcomeSeen nunca lanza aunque storage.setItem falle", () => {
    const throwing: Pick<Storage, "setItem"> = {
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(() => markWelcomeSeen(throwing)).not.toThrow();
  });
});

describe("mountWelcomeDialog", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("showIfFirstRun() muestra el diálogo con el nombre/versión del manifest cuando no se vio antes", () => {
    const storage = memoryStorage();
    const div = container();
    const dialog = mountWelcomeDialog(div, { manifest: fakeManifest(), storage });

    dialog.showIfFirstRun();

    const overlay = div.querySelector(".welcome-dialog-overlay") as HTMLElement;
    expect(overlay.style.display).not.toBe("none");
    expect(div.querySelector(".welcome-dialog-title, h2")?.textContent).toContain("Impulso Sticker Builder Professional");
    expect(div.querySelector("h2")?.textContent).toContain("1.0.0");
  });

  it("showIfFirstRun() no hace nada si ya se vio antes", () => {
    const storage = memoryStorage();
    markWelcomeSeen(storage);
    const div = container();
    const dialog = mountWelcomeDialog(div, { manifest: fakeManifest(), storage });

    dialog.showIfFirstRun();

    const overlay = div.querySelector(".welcome-dialog-overlay") as HTMLElement;
    expect(overlay.style.display).toBe("none");
  });

  it("sin manifest (null), usa un nombre de producto por defecto sin lanzar", () => {
    const storage = memoryStorage();
    const div = container();
    const dialog = mountWelcomeDialog(div, { manifest: null, storage });
    expect(() => dialog.showIfFirstRun()).not.toThrow();
    expect(div.querySelector("h2")?.textContent).toContain("Impulso Sticker Builder");
  });

  it("click en 'Comenzar' cierra el diálogo, marca visto, y restaura el foco previo", () => {
    const storage = memoryStorage();
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();

    const div = container();
    const dialog = mountWelcomeDialog(div, { manifest: fakeManifest(), storage });
    dialog.showIfFirstRun();

    (div.querySelector(".welcome-dialog-close") as HTMLButtonElement).click();

    const overlay = div.querySelector(".welcome-dialog-overlay") as HTMLElement;
    expect(overlay.style.display).toBe("none");
    expect(hasSeenWelcome(storage)).toBe(true);
    expect(document.activeElement).toBe(opener);
  });

  it("Escape cierra el diálogo", () => {
    const storage = memoryStorage();
    const div = container();
    const dialog = mountWelcomeDialog(div, { manifest: fakeManifest(), storage });
    dialog.showIfFirstRun();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    const overlay = div.querySelector(".welcome-dialog-overlay") as HTMLElement;
    expect(overlay.style.display).toBe("none");
  });

  it("Tab siempre devuelve el foco al botón 'Comenzar' (único elemento enfocable real)", () => {
    const storage = memoryStorage();
    const div = container();
    const dialog = mountWelcomeDialog(div, { manifest: fakeManifest(), storage });
    dialog.showIfFirstRun();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));

    expect(document.activeElement).toBe(div.querySelector(".welcome-dialog-close"));
  });

  it("no muestra la línea de soporte si el manifest no tiene support.email", () => {
    const storage = memoryStorage();
    const div = container();
    const dialog = mountWelcomeDialog(div, {
      manifest: fakeManifest({ support: { email: null, docsUrl: null } }),
      storage,
    });
    dialog.showIfFirstRun();
    expect(div.querySelector(".welcome-dialog-support")).toBeNull();
  });

  it("destroy() remueve el diálogo del DOM", () => {
    const storage = memoryStorage();
    const div = container();
    const dialog = mountWelcomeDialog(div, { manifest: fakeManifest(), storage });
    dialog.destroy();
    expect(div.querySelector(".welcome-dialog-overlay")).toBeNull();
  });
});
