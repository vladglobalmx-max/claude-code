import { mountCanvasRuntime } from "./bootstrap.js";

const container = document.getElementById("canvas-runtime");
if (!(container instanceof HTMLDivElement)) {
  throw new Error('No se encontró el contenedor "#canvas-runtime" en index.html.');
}

mountCanvasRuntime(container);
