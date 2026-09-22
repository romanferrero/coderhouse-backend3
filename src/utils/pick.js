// Devuelve solo las claves permitidas que vengan definidas en el objeto.
export const pick = (source = {}, allowedKeys = []) =>
  Object.fromEntries(
    allowedKeys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]])
  );
