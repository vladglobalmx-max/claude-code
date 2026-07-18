import type { AssetId, ObjectId, SceneObject } from "@impulso/document-schema";
import type { ExportWarning } from "../types.js";
import { transformToSvgAttr } from "./transformToSvgAttr.js";
import { styleToSvgAttrs } from "./styleToSvgAttrs.js";
import { rectangleMarkup, ellipseMarkup, pathMarkup } from "./shapeMarkup.js";
import { textMarkup } from "./textMarkup.js";
import { escapeXmlAttr } from "./escapeXml.js";

export interface SvgWalkContext {
  /** Resuelve el `assetId` de una Image a un data URL — `undefined` si no
   * se pudo resolver (ya se encarga de registrar el warning apropiado). */
  resolveImage(assetId: AssetId, objectId: ObjectId): Promise<string | undefined>;
  warnings: ExportWarning[];
  /** Elementos `<filter>` recolectados para insertar en `<defs>` (ver `styleToSvgAttrs.ts`). */
  defs: string[];
}

function placeholderImageMarkup(width: number, height: number): string {
  return `<rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="#999999" stroke-width="1" stroke-dasharray="4,4"/>`;
}

/**
 * Recorre un `SceneObject` (recursivo para `group`) y produce su fragmento
 * SVG: un `<g transform=...>` con la pintura/opacidad/blend/sombra del
 * object envolviendo su elemento de forma (o sus hijos, para un group).
 * Un object oculto (`metadata.visible === false`) no produce NADA — igual
 * que el Renderer, que nunca dibuja un node invisible (ver ADR-0012).
 */
export async function sceneObjectToSvg(object: SceneObject, ctx: SvgWalkContext): Promise<string> {
  if (!object.metadata.visible) return "";

  const isGroup = object.type === "group";
  const { presentationAttrs, filterDef } = styleToSvgAttrs(object.style, object.id, { includePaint: !isGroup });
  if (filterDef) ctx.defs.push(filterDef);

  const attrs = [`transform="${transformToSvgAttr(object)}"`, presentationAttrs].filter(Boolean).join(" ");

  let inner: string;
  switch (object.type) {
    case "rectangle":
      inner = rectangleMarkup(object);
      break;
    case "ellipse":
      inner = ellipseMarkup(object);
      break;
    case "path":
      inner = pathMarkup(object);
      break;
    case "text":
      inner = textMarkup(object);
      break;
    case "image": {
      const dataUrl = await ctx.resolveImage(object.assetId, object.id);
      inner = dataUrl
        ? `<image href="${escapeXmlAttr(dataUrl)}" x="0" y="0" width="${object.size.width}" height="${object.size.height}" preserveAspectRatio="none"/>`
        : placeholderImageMarkup(object.size.width, object.size.height);
      break;
    }
    case "group": {
      const children = await Promise.all(object.children.map((child) => sceneObjectToSvg(child, ctx)));
      inner = children.join("");
      break;
    }
  }

  return `<g ${attrs}>${inner}</g>`;
}
