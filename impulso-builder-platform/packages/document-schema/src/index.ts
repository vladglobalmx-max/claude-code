// Primitivos
export * from "./primitives/identifiers.js";
export * from "./primitives/geometry.js";
export * from "./primitives/json.js";

// Bloques comunes (reutilizados por todas las entidades)
export * from "./common/metadata.js";
export * from "./common/pluginData.js";
export * from "./common/customProperties.js";

// Estilo y assets
export * from "./style/style.js";
export * from "./asset/base.js";
export * from "./asset/asset.js";

// Objects (Rectangle, Ellipse, Path, Image, Text, Group + unión SceneObject)
export * from "./object/base.js";
export * from "./object/rectangle.js";
export * from "./object/ellipse.js";
export * from "./object/path.js";
export * from "./object/image.js";
export * from "./object/text.js";
export * from "./object/object.js";

// Layer, Page
export * from "./layer/layer.js";
export * from "./page/page.js";

// Historial (dato puro, sin lógica de undo/redo)
export * from "./history/history.js";

// Versionado y migraciones
export * from "./version/constants.js";
export * from "./version/migration.js";

// Document, Project
export * from "./document/document.js";
export * from "./project/project.js";

// Serialización (validar / serializar / deserializar / clonar)
export * from "./serialization/core.js";
export * from "./serialization/documentSerialization.js";
export * from "./serialization/projectSerialization.js";
