import { findObjectInDocument, type Engine } from "@impulso/engine";
import type { ObjectId, SceneObject } from "@impulso/document-schema";

export interface Inspector {
  destroy(): void;
}

function field(labelText: string, input: HTMLElement): HTMLElement {
  const wrapper = document.createElement("label");
  wrapper.className = "inspector-field";
  const label = document.createElement("span");
  label.textContent = labelText;
  wrapper.appendChild(label);
  wrapper.appendChild(input);
  return wrapper;
}

function numberInput(value: number, step: number, onCommit: (value: number) => void): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.step = String(step);
  input.value = String(value);
  input.addEventListener("change", () => {
    const parsed = Number(input.value);
    if (!Number.isNaN(parsed)) onCommit(parsed);
  });
  return input;
}

function colorInput(value: string | undefined, onCommit: (value: string) => void): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "color";
  input.value = value ?? "#000000";
  input.addEventListener("input", () => onCommit(input.value));
  return input;
}

function textInput(value: string, onCommit: (value: string) => void): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.addEventListener("change", () => onCommit(input.value));
  return input;
}

function selectInput(
  options: readonly { value: string; label: string }[],
  current: string,
  onCommit: (value: string) => void,
): HTMLSelectElement {
  const select = document.createElement("select");
  for (const option of options) {
    const el = document.createElement("option");
    el.value = option.value;
    el.textContent = option.label;
    if (option.value === current) el.selected = true;
    select.appendChild(el);
  }
  select.addEventListener("change", () => onCommit(select.value));
  return select;
}

function section(title: string, fields: HTMLElement[]): HTMLElement {
  const el = document.createElement("fieldset");
  el.className = "inspector-section";
  const legend = document.createElement("legend");
  legend.textContent = title;
  el.appendChild(legend);
  for (const f of fields) el.appendChild(f);
  return el;
}

/** Ancho/alto derivables directamente del Document Schema (sin necesitar
 * medir el node Konva, ver ADR-0010) — solo para tipos con `size` propio. */
function derivedSize(object: SceneObject): { width: number; height: number } | undefined {
  if (object.type === "rectangle" || object.type === "ellipse" || object.type === "image") {
    return { width: object.size.width * object.transform.scaleX, height: object.size.height * object.transform.scaleY };
  }
  if (object.type === "text" && object.size) {
    return { width: object.size.width * object.transform.scaleX, height: object.size.height * object.transform.scaleY };
  }
  return undefined;
}

/**
 * Sidebar derecha = Inspector: cambia según la selección (0, 1 o 2+
 * objects). Con un único object, expone Transformar/Apariencia/Texto
 * (solo si aplica)/Metadata; con selección múltiple, solo Opacidad (ver
 * ADR-0010 — mostrar X/Y/Ancho/Alto "promedio" de una selección múltiple
 * confundiría más de lo que ayudaría).
 */
export function mountInspector(container: HTMLElement, engine: Engine): Inspector {
  function dispatchTransform(objectId: ObjectId, patch: Record<string, number>): void {
    engine.dispatch({ type: "updateObjectTransform", objectId, transform: patch });
  }

  function renderEmpty(): void {
    const message = document.createElement("p");
    message.className = "inspector-empty";
    message.textContent = "Nada seleccionado.";
    container.appendChild(message);
  }

  function renderMultiSelection(ids: readonly ObjectId[]): void {
    const opacity = numberInput(1, 0.01, (value) => {
      for (const id of ids) engine.dispatch({ type: "updateObjectStyle", objectId: id, style: { opacity: value } });
    });
    container.appendChild(section("Apariencia", [field("Opacidad", opacity)]));
  }

  function renderSingleSelection(object: SceneObject): void {
    const size = derivedSize(object);
    const transformFields = [
      field("X", numberInput(object.transform.x, 1, (v) => dispatchTransform(object.id, { x: v }))),
      field("Y", numberInput(object.transform.y, 1, (v) => dispatchTransform(object.id, { y: v }))),
      field(
        "Rotación",
        numberInput(object.transform.rotation, 1, (v) => dispatchTransform(object.id, { rotation: v })),
      ),
    ];
    if (size) {
      transformFields.splice(
        2,
        0,
        field(
          "Ancho",
          numberInput(size.width, 1, (v) => dispatchTransform(object.id, { scaleX: v / (size.width / object.transform.scaleX) })),
        ),
        field(
          "Alto",
          numberInput(size.height, 1, (v) => dispatchTransform(object.id, { scaleY: v / (size.height / object.transform.scaleY) })),
        ),
      );
    }
    container.appendChild(section("Transformar", transformFields));

    const appearanceFields = [
      field(
        "Opacidad",
        numberInput(object.style.opacity, 0.01, (v) =>
          engine.dispatch({ type: "updateObjectStyle", objectId: object.id, style: { opacity: v } }),
        ),
      ),
    ];
    if (object.type !== "group") {
      appearanceFields.push(
        field(
          "Relleno",
          colorInput(object.style.fill, (v) =>
            engine.dispatch({ type: "updateObjectStyle", objectId: object.id, style: { fill: v } }),
          ),
        ),
      );
    }
    container.appendChild(section("Apariencia", appearanceFields));

    if (object.type === "text") {
      const contentInput = document.createElement("textarea");
      contentInput.value = object.content;
      contentInput.addEventListener("change", () => {
        engine.dispatch({ type: "updateObjectContent", objectId: object.id, content: contentInput.value });
      });
      container.appendChild(
        section("Texto", [
          field("Contenido", contentInput),
          field("Tipografía", textInput(object.fontFamily, (v) => dispatchFontFamily(object.id, v))),
          field("Tamaño", numberInput(object.fontSize, 1, (v) => dispatchFontSize(object.id, v))),
          field(
            "Alineación",
            selectInput(
              [
                { value: "left", label: "Izquierda" },
                { value: "center", label: "Centro" },
                { value: "right", label: "Derecha" },
              ],
              object.textAlign,
              (v) => dispatchTextAlign(object.id, v as "left" | "center" | "right"),
            ),
          ),
        ]),
      );
    }

    const nameInput = textInput(object.metadata.name ?? "", (v) =>
      engine.dispatch({
        type: "updateMetadata",
        target: { level: "object", objectId: object.id },
        metadata: { name: v || undefined },
      }),
    );
    container.appendChild(section("Metadata", [field("Nombre", nameInput)]));
  }

  // `updateObjectStyle`/`updateObjectTransform` no cubren fontFamily/fontSize/
  // textAlign (son campos propios de TextObject, no de Style/Transform) —
  // hoy no existe un comando dedicado para editarlos individualmente; se
  // documenta como deuda técnica (ver README) y, mientras tanto, se
  // recompone el object completo vía `addObject` tras `removeObject` NO se
  // usa aquí para no perder posición en el árbol — en su lugar, estos tres
  // campos quedan de solo lectura hasta que exista un comando apropiado.
  function dispatchFontFamily(_objectId: ObjectId, _value: string): void {
    // Deliberadamente no-op — ver comentario arriba y README, "Deuda técnica".
  }
  function dispatchFontSize(_objectId: ObjectId, _value: number): void {
    // Deliberadamente no-op — ver comentario arriba y README, "Deuda técnica".
  }
  function dispatchTextAlign(_objectId: ObjectId, _value: "left" | "center" | "right"): void {
    // Deliberadamente no-op — ver comentario arriba y README, "Deuda técnica".
  }

  function render(): void {
    container.innerHTML = "";
    const selection = engine.getSelection();
    if (selection.length === 0) {
      renderEmpty();
      return;
    }
    if (selection.length > 1) {
      renderMultiSelection(selection);
      return;
    }
    const object = findObjectInDocument(engine.getProject().document, selection[0]!);
    if (!object) {
      // Defensivo: el Engine ya poda ids de selección inexistentes en cuanto
      // el Document cambia (ver `pruneSelection`), así que este caso no
      // debería ocurrir en uso normal.
      renderEmpty();
      return;
    }
    renderSingleSelection(object);
  }

  const unsubscribe = engine.subscribe((event) => {
    if (event.type === "projectChanged" || event.type === "selectionChanged") render();
  });
  render();

  return { destroy: () => unsubscribe() };
}
