import type { EllipseObject, RectangleObject } from "@impulso/document-schema";
import { segmentsToSvgPathData, type PathObject } from "@impulso/document-schema";
import { escapeXmlAttr } from "./escapeXml.js";

/** Todos dibujan en el origen local (0,0) que ya estableció el `<g transform>`
 * envolvente (`transformToSvgAttr.ts`) — top-left para Rectangle/Path, centro
 * para Ellipse (ver ese archivo para el porqué). */

export function rectangleMarkup(object: RectangleObject): string {
  return `<rect x="0" y="0" width="${object.size.width}" height="${object.size.height}" rx="${object.cornerRadius}"/>`;
}

export function ellipseMarkup(object: EllipseObject): string {
  return `<ellipse cx="0" cy="0" rx="${object.size.width / 2}" ry="${object.size.height / 2}"/>`;
}

export function pathMarkup(object: PathObject): string {
  const d = segmentsToSvgPathData(object.segments, object.closed);
  return `<path d="${escapeXmlAttr(d)}"/>`;
}
