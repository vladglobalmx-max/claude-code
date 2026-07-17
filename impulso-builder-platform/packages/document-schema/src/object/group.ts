/**
 * Group vive físicamente en object.ts (junto con SceneObject) porque ambos
 * tipos son mutuamente recursivos y Zod solo puede resolver ese ciclo si
 * están en el mismo módulo. Este archivo re-exporta para que "Group" sea
 * localizable como archivo propio, igual que el resto de los tipos de
 * Object.
 */
export { GroupObjectSchema, type GroupObject } from "./object.js";
