import { Schema } from 'mongoose';

// Metadatos de un archivo subido. Es un subdocumento: queda dentro de la entidad a la que pertenece
// (users.documents, deliveries.proofs). El archivo en sí está en uploads/, nunca en MongoDB.
export const createDocumentSchema = (documentTypes) =>
  new Schema(
    {
      documentType: { type: String, enum: documentTypes, required: true },
      originalName: { type: String, required: true },
      fileName: { type: String, required: true },
      path: { type: String, required: true },
      mimeType: { type: String, required: true },
      size: { type: Number, required: true, min: 0 },
      uploadedAt: { type: Date, required: true, default: Date.now },
    },
    { versionKey: false }
  );
