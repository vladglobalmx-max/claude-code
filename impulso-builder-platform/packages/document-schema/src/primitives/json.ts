import { z } from "zod";

/**
 * Un valor arbitrario pero garantizado JSON-serializable. Es el tipo base
 * para `CustomProperties` y para el campo `patch` de `HistoryEntry`: datos
 * de forma libre que este paquete no necesita entender, pero que sí debe
 * poder validar, serializar y clonar sin perder información.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);
