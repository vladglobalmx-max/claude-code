import type { ObjectId, SceneObject } from "@impulso/document-schema";

export interface CloneSceneObjectOptions {
  /** Desplazamiento aplicado SOLO al `transform.x/y` del object de nivel
   * superior — los hijos de un Group conservan su posición relativa
   * intacta (están expresados en el espacio local del Group, no del
   * documento). Por defecto, sin desplazamiento. */
  offset?: { x: number; y: number };
}

/**
 * Clona un `SceneObject` (recursivamente, si es un `group`) asignando un id
 * NUEVO a cada nodo del subárbol — nunca reutiliza ningún id del original.
 * `generateId` lo provee quien llama (el Engine nunca inventa identidad
 * para contenido del usuario, mismo principio que rige `addObject`/
 * `groupObjects`): esta función es una utilidad pura, no un comando
 * dispatchable, pensada para que "Duplicar" (Sticker Creation Experience)
 * reutilice el comando `addObject` ya existente en vez de necesitar uno
 * nuevo — clonar-con-ids-frescos es la única pieza que `addObject` no
 * puede hacer por sí solo.
 */
export function cloneSceneObjectWithNewIds(
  object: SceneObject,
  generateId: () => ObjectId,
  now: string,
  options: CloneSceneObjectOptions = {},
): SceneObject {
  return cloneNode(object, generateId, now, options.offset);
}

function cloneNode(
  object: SceneObject,
  generateId: () => ObjectId,
  now: string,
  offset: { x: number; y: number } | undefined,
): SceneObject {
  const id = generateId();
  const metadata = { ...object.metadata, createdAt: now, updatedAt: now };
  const transform = offset
    ? { ...object.transform, x: object.transform.x + offset.x, y: object.transform.y + offset.y }
    : object.transform;

  if (object.type === "group") {
    return {
      ...object,
      id,
      metadata,
      transform,
      // Los hijos NO reciben `offset`: su x/y ya es relativo al Group, que
      // es quien se desplaza — desplazarlos también duplicaría el efecto.
      children: object.children.map((child) => cloneNode(child, generateId, now, undefined)),
    };
  }

  return { ...object, id, metadata, transform };
}
