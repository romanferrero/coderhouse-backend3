// Un campo está vacío si no vino, es null o es un string con solo espacios.
export const isBlank = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

// Devuelve los campos de `fields` que están vacíos en `data`.
export const findBlankFields = (data, fields) => fields.filter((field) => isBlank(data[field]));

// Para updates: solo revisa los campos obligatorios que efectivamente se enviaron.
export const findBlankProvidedFields = (data, fields) =>
  fields.filter((field) => field in data && isBlank(data[field]));
