import Konva from "konva";
import type { GroupObject, SceneObject } from "@impulso/document-schema";
import { applyBaseAttrs } from "../baseAttrs.js";
import type { NodeContext } from "../types.js";

/**
 * No importa `sceneNode.ts` (el dispatcher que sabe crear cualquier tipo de
 * Object, incluido `group`) para evitar un ciclo de imports: recibe la
 * función de creación de hijos por parámetro. `sceneNode.ts` es quien pasa
 * su propio dispatcher recursivamente al llamar a esta función.
 */
export function createGroupNode(
  object: GroupObject,
  context: NodeContext,
  createChildNode: (child: SceneObject, context: NodeContext) => Konva.Shape | Konva.Group,
): Konva.Group {
  const node = new Konva.Group();
  applyBaseAttrs(node, object, context);
  // Los hijos NUNCA son individualmente interactivos, sin importar si el
  // propio Group lo es — el Group actúa como una única unidad
  // seleccionable/arrastrable (ver baseAttrs.ts, types.ts, ADR-0010). Esto
  // también cubre groups anidados a cualquier profundidad: una vez dentro
  // de un group, `interactive: false` se sigue propagando hacia abajo.
  const childContext: NodeContext = { ...context, interactive: false };
  for (const child of object.children) {
    node.add(createChildNode(child, childContext));
  }
  return node;
}
