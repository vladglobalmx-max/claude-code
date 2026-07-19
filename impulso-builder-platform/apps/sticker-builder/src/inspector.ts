import { findObjectInDocument, type Engine } from "@impulso/engine";
import { fromPixels, toPixels, type ObjectId, type SceneObject } from "@impulso/document-schema";
import { evaluateNumericExpression } from "./numericExpression.js";

export interface Inspector {
  destroy(): void;
}

const LIVE_PREVIEW_DEBOUNCE_MS = 300;
const NUMERIC_EXPRESSION_HINT =
  'Valor absoluto, o expresión relativa de un paso: +n, -n, *n, /n (ej. "+5", "*2"). Enter o clic afuera confirma.';

function field(labelText: string, input: HTMLElement): HTMLElement {
  const wrapper = document.createElement("label");
  wrapper.className = "inspector-field";
  const label = document.createElement("span");
  label.textContent = labelText;
  wrapper.appendChild(label);
  wrapper.appendChild(input);
  return wrapper;
}

function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * Wiring compartido por todo campo editable "vivo": vista previa mientras se
 * escribe (debounced, ver ADR sobre preview-then-commit — este es el
 * equivalente para Inspector, sin gesto de puntero continuo) + confirmación
 * inmediata al perder foco o presionar Enter (Epic 7 / Fase 7.1).
 *
 * `onCommit` devuelve si el Engine aceptó el cambio (`EngineResult.ok`): si
 * lo rechaza (ej. un fontSize <= 0, una opacity fuera de [0,1]), el campo se
 * marca inválido y NO actualiza su valor "confirmado" — un control nunca
 * debe verse como si hubiera funcionado cuando el Engine lo rechazó.
 */
function attachDebouncedCommit<T>(
  input: HTMLInputElement,
  initial: T,
  opts: {
    parse: (raw: string, committed: T) => T | undefined;
    format: (value: T) => string;
    onCommit: (value: T) => boolean;
    debounceMs?: number;
  },
): void {
  let committed = initial;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function setInvalid(invalid: boolean): void {
    input.classList.toggle("inspector-field-invalid", invalid);
    if (invalid) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  function tryCommit(): void {
    const parsed = opts.parse(input.value, committed);
    if (parsed === undefined) {
      setInvalid(true);
      return;
    }
    if (Object.is(parsed, committed)) {
      setInvalid(false);
      input.value = opts.format(parsed);
      return;
    }
    const accepted = opts.onCommit(parsed);
    if (!accepted) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    committed = parsed;
    input.value = opts.format(parsed);
  }

  function revertIfStillInvalid(): void {
    if (input.classList.contains("inspector-field-invalid")) {
      setInvalid(false);
      input.value = opts.format(committed);
    }
  }

  input.addEventListener("input", () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(tryCommit, opts.debounceMs ?? LIVE_PREVIEW_DEBOUNCE_MS);
  });
  input.addEventListener("change", () => {
    if (timer) clearTimeout(timer);
    tryCommit();
  });
  input.addEventListener("blur", () => {
    if (timer) clearTimeout(timer);
    tryCommit();
    revertIfStillInvalid();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    }
  });
}

function numericField(
  currentValue: number,
  opts: { title?: string; unitLabel?: string; onCommit: (value: number) => boolean },
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "inspector-number-wrapper";

  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.className = "inspector-number-input";
  input.value = formatNumber(currentValue);
  input.title = opts.title ?? NUMERIC_EXPRESSION_HINT;

  attachDebouncedCommit(input, currentValue, {
    parse: (raw, committed) => evaluateNumericExpression(committed, raw),
    format: formatNumber,
    onCommit: opts.onCommit,
  });

  wrapper.appendChild(input);
  if (opts.unitLabel) {
    wrapper.classList.add("inspector-number-wrapper--with-unit");
    const unitEl = document.createElement("span");
    unitEl.className = "inspector-unit";
    unitEl.textContent = opts.unitLabel;
    wrapper.appendChild(unitEl);
  }
  return wrapper;
}

function fontFamilyInput(currentValue: string, onCommit: (value: string) => boolean): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.value = currentValue;
  input.title = "Nombre de la familia tipográfica. No puede quedar vacío.";
  attachDebouncedCommit(input, currentValue, {
    parse: (raw) => (raw.trim().length > 0 ? raw.trim() : undefined),
    format: (value) => value,
    onCommit,
  });
  return input;
}

function colorInput(value: string | undefined, onCommit: (value: string) => void): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "color";
  input.value = value ?? "#000000";
  input.title = "Color de relleno.";
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
 * medir el node Konva, ver ADR-0010) — solo para tipos con `size` propio.
 * Están en la unidad canónica interna (el mismo espacio numérico que
 * `Transform.x/y`, independiente de `Page.unit`) — la conversión a la
 * unidad activa del documento ocurre en el llamador, no aquí. */
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
 * confundiría más de lo que ayudaría; multi-selección profesional real
 * queda para Fase 7.4).
 *
 * Unidad activa (Epic 7 / Fase 7.1): siempre `page.unit` — se usa para
 * mostrar y confirmar X/Y/Ancho/Alto. Internamente todo sigue viajando en
 * la unidad canónica (px); la conversión ocurre una sola vez al mostrar
 * (`fromPixels`) y una sola vez al confirmar (`toPixels`), nunca en cadena.
 */
export function mountInspector(container: HTMLElement, engine: Engine): Inspector {
  function currentUnit(): "px" | "mm" | "in" {
    return engine.getProject().document.pages[0]?.unit ?? "px";
  }

  function dispatchTransform(objectId: ObjectId, patch: Record<string, number>): boolean {
    return engine.dispatch({ type: "updateObjectTransform", objectId, transform: patch }).ok;
  }

  function renderEmpty(): void {
    const message = document.createElement("p");
    message.className = "inspector-empty";
    message.textContent = "Nada seleccionado.";
    container.appendChild(message);
  }

  function renderMultiSelection(ids: readonly ObjectId[]): void {
    const opacity = numericField(1, {
      onCommit: (value) => {
        let allOk = true;
        for (const id of ids) {
          const result = engine.dispatch({ type: "updateObjectStyle", objectId: id, style: { opacity: value } });
          if (!result.ok) allOk = false;
        }
        return allOk;
      },
    });
    container.appendChild(section("Apariencia", [field("Opacidad", opacity)]));
  }

  function renderSingleSelection(object: SceneObject): void {
    const unit = currentUnit();
    const size = derivedSize(object);
    const transformFields = [
      field(
        "X",
        numericField(fromPixels(object.transform.x, unit), {
          unitLabel: unit,
          onCommit: (v) => dispatchTransform(object.id, { x: toPixels(v, unit) }),
        }),
      ),
      field(
        "Y",
        numericField(fromPixels(object.transform.y, unit), {
          unitLabel: unit,
          onCommit: (v) => dispatchTransform(object.id, { y: toPixels(v, unit) }),
        }),
      ),
      field(
        "Rotación",
        numericField(object.transform.rotation, {
          unitLabel: "°",
          onCommit: (v) => dispatchTransform(object.id, { rotation: v }),
        }),
      ),
    ];
    if (size) {
      transformFields.splice(
        2,
        0,
        field(
          "Ancho",
          numericField(fromPixels(size.width, unit), {
            unitLabel: unit,
            onCommit: (vDisplay) => {
              const vPx = toPixels(vDisplay, unit);
              return dispatchTransform(object.id, { scaleX: vPx / (size.width / object.transform.scaleX) });
            },
          }),
        ),
        field(
          "Alto",
          numericField(fromPixels(size.height, unit), {
            unitLabel: unit,
            onCommit: (vDisplay) => {
              const vPx = toPixels(vDisplay, unit);
              return dispatchTransform(object.id, { scaleY: vPx / (size.height / object.transform.scaleY) });
            },
          }),
        ),
      );
    }
    container.appendChild(section("Transformar", transformFields));

    const appearanceFields = [
      field(
        "Opacidad",
        numericField(object.style.opacity, {
          onCommit: (v) => engine.dispatch({ type: "updateObjectStyle", objectId: object.id, style: { opacity: v } }).ok,
        }),
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
      contentInput.title = "Contenido del texto.";
      contentInput.addEventListener("change", () => {
        engine.dispatch({ type: "updateObjectContent", objectId: object.id, content: contentInput.value });
      });
      container.appendChild(
        section("Texto", [
          field("Contenido", contentInput),
          field(
            "Tipografía",
            fontFamilyInput(object.fontFamily, (v) =>
              engine.dispatch({ type: "updateTextStyle", objectId: object.id, textStyle: { fontFamily: v } }).ok,
            ),
          ),
          field(
            "Tamaño",
            numericField(object.fontSize, {
              unitLabel: "px",
              onCommit: (v) =>
                engine.dispatch({ type: "updateTextStyle", objectId: object.id, textStyle: { fontSize: v } }).ok,
            }),
          ),
          field(
            "Alineación",
            selectInput(
              [
                { value: "left", label: "Izquierda" },
                { value: "center", label: "Centro" },
                { value: "right", label: "Derecha" },
              ],
              object.textAlign,
              (v) =>
                engine.dispatch({
                  type: "updateTextStyle",
                  objectId: object.id,
                  textStyle: { textAlign: v as "left" | "center" | "right" },
                }),
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
    nameInput.title = "Nombre visible en el panel de Layers.";
    container.appendChild(section("Metadata", [field("Nombre", nameInput)]));
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
