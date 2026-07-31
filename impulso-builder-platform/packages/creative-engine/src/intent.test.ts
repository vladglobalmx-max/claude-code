import { describe, expect, it } from "vitest";
import { interpretar } from "./intent.js";

describe("interpretar", () => {
  it("extrae la ocasión fija 'boda' — única ocasión soportada en esta fase", () => {
    expect(interpretar("Etiquetas para la boda de Marcela y Andrés").occasion).toBe("boda");
    expect(interpretar("etiquetas para mi negocio").occasion).toBe("boda");
  });

  describe("nombres", () => {
    it("caso canónico: 'de X y Y'", () => {
      expect(interpretar("Etiquetas para la boda de Marcela y Andrés").names).toEqual(["Marcela", "Andrés"]);
    });

    it("'X & Y' sin conector 'de'", () => {
      expect(interpretar("Sello para Marcela & Andrés").names).toEqual(["Marcela", "Andrés"]);
    });

    it("frase corta sin nombres: no bloquea, devuelve lista vacía", () => {
      expect(interpretar("etiquetas para mi boda").names).toEqual([]);
    });

    it("frase fragmentada por puntos: cada fragmento es una señal independiente", () => {
      expect(interpretar("Boda. Marcela. Andrés.").names).toEqual(["Marcela", "Andrés"]);
    });

    it("un solo nombre detectable", () => {
      expect(interpretar("Etiquetas de boda para Marcela").names).toEqual(["Marcela"]);
    });

    it("informal/con errores ortográficos: normaliza en silencio, igual extrae nombres", () => {
      expect(interpretar("etiketas pa la boda de Marcela y Andres").names).toEqual(["Marcela", "Andres"]);
    });

    it("nunca confunde la primera palabra de la frase (mayúscula solo por ser inicio) con un nombre", () => {
      expect(interpretar("Etiquetas para mi boda").names).toEqual([]);
    });

    it("contradictoria (dos ocasiones mencionadas): igual extrae los nombres presentes, sin bloquear", () => {
      const intent = interpretar("Para mi boda, para mi negocio, de Marcela y Andrés");
      expect(intent.names).toEqual(["Marcela", "Andrés"]);
      expect(intent.occasion).toBe("boda");
    });
  });

  describe("fecha", () => {
    it("con nombre de mes en español", () => {
      expect(interpretar("Boda de Marcela y Andrés el 15 de agosto de 2026").date).toBe("15 de agosto de 2026");
    });

    it("numérica", () => {
      expect(interpretar("Boda de Marcela y Andrés el 15/08/2026").date).toBe("15/08/2026");
    });

    it("ausente: no aparece en el Intent", () => {
      expect(interpretar("Boda de Marcela y Andrés").date).toBeUndefined();
    });
  });

  describe("color", () => {
    it("señal explícita reconocida", () => {
      expect(interpretar("Boda de Marcela y Andrés en dorado").color).toBe("#b08d57");
    });

    it("ausente: no aparece en el Intent", () => {
      expect(interpretar("Boda de Marcela y Andrés").color).toBeUndefined();
    });

    it("no inventa un color a partir de una palabra parecida", () => {
      expect(interpretar("Boda de Marcela y Andrés en el jardín").color).toBeUndefined();
    });
  });
});
