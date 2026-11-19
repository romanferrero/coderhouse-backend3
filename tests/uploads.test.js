import fs from 'node:fs/promises';
import { expect } from 'chai';
import { api } from './helpers/api.js';
import { clearDatabase } from './helpers/db.js';
import { expectSuccess, expectError, expectPublicUser } from './helpers/assertions.js';
import { NON_EXISTENT_ID, createCustomer, createCourier, createOrder, createDelivery } from './helpers/fixtures.js';
import {
  clearUploads,
  listUploads,
  absoluteUploadPath,
  pdfFile,
  jpgFile,
  pngFile,
  gifFile,
  fakePdfFile,
  pngDisguisedAsJpgFile,
  oversizedPdfFile,
  binaryParser,
} from './helpers/uploads.js';
import { UserModel } from '../src/models/user.model.js';
import { DeliveryModel } from '../src/models/delivery.model.js';

const USER_DOCUMENT_TYPES = ['ID_CARD', 'DRIVER_LICENSE', 'PROOF_OF_ADDRESS'];
const DELIVERY_PROOF_TYPES = ['DELIVERY_PHOTO', 'SIGNED_RECEIPT'];
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENTS_PER_ENTITY = 10;
// Nombre generado por el servidor: fecha en milisegundos + UUID + extensión.
const GENERATED_NAME = /^\d{13}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|jpeg|png)$/;

// Metadatos que se guardan en MongoDB por cada archivo, y que el archivo exista en disco con el
// mismo contenido que se subió.
const expectStoredDocument = async (doc, { file, documentType, folder }) => {
  expect(doc).to.have.all.keys(
    '_id',
    'documentType',
    'originalName',
    'fileName',
    'path',
    'mimeType',
    'size',
    'uploadedAt'
  );
  expect(doc.documentType).to.equal(documentType);
  expect(doc.originalName).to.equal(file.options.filename);
  expect(doc.fileName).to.match(GENERATED_NAME);
  expect(doc.path).to.equal(`uploads/test/${folder}/${doc.fileName}`);
  expect(doc.mimeType).to.equal(file.options.contentType);
  expect(doc.size).to.equal(file.content.length);
  expect(new Date(doc.uploadedAt).getTime()).to.be.closeTo(Date.now(), 10_000);

  const saved = await fs.readFile(absoluteUploadPath(doc.path));
  expect(saved.equals(file.content)).to.equal(true);
};

const uploadUserDocument = (uid, file, documentType) => {
  const req = api.post(`/api/users/${uid}/documents`);
  if (documentType !== undefined) req.field('documentType', documentType);
  return file ? req.attach('document', file.content, file.options) : req;
};

const uploadDeliveryProof = (did, file, documentType) => {
  const req = api.post(`/api/deliveries/${did}/proofs`);
  if (documentType !== undefined) req.field('documentType', documentType);
  return file ? req.attach('proof', file.content, file.options) : req;
};

// Metadatos de archivos ya cargados, insertados directo en la base para llegar al máximo sin subir 10 archivos.
const storedDocuments = (folder, documentType, qty = MAX_DOCUMENTS_PER_ENTITY) =>
  Array.from({ length: qty }, (_, i) => ({
    documentType,
    originalName: `archivo-${i}.pdf`,
    fileName: `archivo-${i}.pdf`,
    path: `uploads/test/${folder}/archivo-${i}.pdf`,
    mimeType: 'application/pdf',
    size: 100,
  }));

const download = (url) => api.get(url).buffer(true).parse(binaryParser);

describe('Carga de archivos — documentos y comprobantes', () => {
  // Cada test arranca con la base y la carpeta uploads/test/ vacías.
  beforeEach(async () => {
    await clearDatabase();
    await clearUploads();
  });

  after(async () => {
    await clearDatabase();
    await clearUploads();
  });

  describe('POST /api/users/:uid/documents', () => {
    let user;

    beforeEach(async () => {
      user = await createCourier();
    });

    it('guarda el archivo en uploads/users y registra sus metadatos en el usuario', async () => {
      const file = pdfFile('licencia.pdf');

      const payload = expectSuccess(await uploadUserDocument(user._id, file, 'DRIVER_LICENSE'), 201);

      expectPublicUser(payload);
      expect(payload._id).to.equal(user._id);
      expect(payload.documents).to.have.lengthOf(1);
      await expectStoredDocument(payload.documents[0], { file, documentType: 'DRIVER_LICENSE', folder: 'users' });
      expect(await listUploads('users')).to.deep.equal([payload.documents[0].fileName]);
    });

    it('el documento queda asociado al usuario al consultarlo', async () => {
      const uploaded = expectSuccess(await uploadUserDocument(user._id, pdfFile(), 'ID_CARD'), 201);

      const found = expectSuccess(await api.get(`/api/users/${user._id}`), 200);

      expect(found.documents).to.deep.equal(uploaded.documents);
    });

    it('acepta el tipo de documento en minúsculas, imágenes JPG y varios documentos por usuario', async () => {
      await uploadUserDocument(user._id, pdfFile('dni.pdf'), 'ID_CARD');
      const file = jpgFile('Factura-Luz.JPG');

      const payload = expectSuccess(await uploadUserDocument(user._id, file, 'proof_of_address'), 201);

      expect(payload.documents.map((doc) => doc.documentType)).to.deep.equal(['ID_CARD', 'PROOF_OF_ADDRESS']);
      await expectStoredDocument(payload.documents[1], { file, documentType: 'PROOF_OF_ADDRESS', folder: 'users' });
      expect(payload.documents[1].fileName).to.match(/\.jpg$/);
      expect(await listUploads('users')).to.have.lengthOf(2);
    });

    it('acepta imágenes PNG', async () => {
      const file = pngFile('dni-escaneado.png');

      const payload = expectSuccess(await uploadUserDocument(user._id, file, 'ID_CARD'), 201);

      await expectStoredDocument(payload.documents[0], { file, documentType: 'ID_CARD', folder: 'users' });
    });

    it('400 FILE_REQUIRED si no se envía ningún archivo', async () => {
      const body = expectError(await uploadUserDocument(user._id, null, 'ID_CARD'), 400, 'FILE_REQUIRED');

      expect(body.details).to.deep.equal({ field: 'document' });
    });

    it('400 FILE_REQUIRED si el body no es multipart/form-data', async () => {
      const res = await api.post(`/api/users/${user._id}/documents`).send({ documentType: 'ID_CARD' });

      const body = expectError(res, 400, 'FILE_REQUIRED');

      expect(body.details).to.deep.equal({ field: 'document' });
    });

    it('400 INVALID_FILE_TYPE con un tipo de archivo no permitido y no guarda nada', async () => {
      const body = expectError(await uploadUserDocument(user._id, gifFile(), 'ID_CARD'), 400, 'INVALID_FILE_TYPE');

      expect(body.details).to.deep.equal({
        fileName: 'animacion.gif',
        mimeType: 'image/gif',
        allowed: ALLOWED_EXTENSIONS,
      });
      expect(await listUploads('users')).to.deep.equal([]);
    });

    it('400 INVALID_FILE_TYPE si la extensión no coincide con el tipo declarado', async () => {
      const file = {
        content: Buffer.from('MZ ejecutable'),
        options: { filename: 'dni.exe', contentType: 'application/pdf' },
      };

      const body = expectError(await uploadUserDocument(user._id, file, 'ID_CARD'), 400, 'INVALID_FILE_TYPE');

      expect(body.details).to.include({ fileName: 'dni.exe', mimeType: 'application/pdf' });
      expect(await listUploads('users')).to.deep.equal([]);
    });

    // El nombre y el tipo los declara el cliente: la API lee los primeros bytes del archivo.
    it('400 INVALID_FILE_TYPE si el contenido no es un PDF aunque el nombre y el tipo lo digan', async () => {
      const body = expectError(await uploadUserDocument(user._id, fakePdfFile(), 'ID_CARD'), 400, 'INVALID_FILE_TYPE');

      expect(body.details).to.deep.equal({ fileName: 'dni.pdf', mimeType: 'application/pdf', detected: null });
      expect(body.message).to.include('no corresponde a un archivo application/pdf');
      expect(await listUploads('users')).to.deep.equal([]);
    });

    it('400 INVALID_FILE_TYPE si es un PNG renombrado a .jpg', async () => {
      const body = expectError(
        await uploadUserDocument(user._id, pngDisguisedAsJpgFile(), 'ID_CARD'),
        400,
        'INVALID_FILE_TYPE'
      );

      expect(body.details).to.deep.equal({ fileName: 'foto.jpg', mimeType: 'image/jpeg', detected: 'image/png' });
      expect(await listUploads('users')).to.deep.equal([]);
    });

    it('400 INVALID_FILE_TYPE si el archivo está vacío', async () => {
      const file = { content: Buffer.alloc(0), options: { filename: 'vacio.pdf', contentType: 'application/pdf' } };

      const body = expectError(await uploadUserDocument(user._id, file, 'ID_CARD'), 400, 'INVALID_FILE_TYPE');

      expect(body.details).to.deep.equal({ fileName: 'vacio.pdf', mimeType: 'application/pdf', detected: null });
      expect(await listUploads('users')).to.deep.equal([]);
    });

    it('413 FILE_TOO_LARGE si el archivo supera los 5 MB y no guarda nada', async () => {
      const body = expectError(
        await uploadUserDocument(user._id, oversizedPdfFile(), 'ID_CARD'),
        413,
        'FILE_TOO_LARGE'
      );

      expect(body.details).to.deep.equal({ field: 'document', maxSizeBytes: MAX_FILE_SIZE_BYTES });
      expect(await listUploads('users')).to.deep.equal([]);
      const found = expectSuccess(await api.get(`/api/users/${user._id}`), 200);
      expect(found.documents).to.deep.equal([]);
    });

    it('400 UNEXPECTED_FILE_FIELD si el archivo llega en otro campo', async () => {
      const { content, options } = pdfFile();
      const res = await api
        .post(`/api/users/${user._id}/documents`)
        .field('documentType', 'ID_CARD')
        .attach('archivo', content, options);

      const body = expectError(res, 400, 'UNEXPECTED_FILE_FIELD');

      expect(body.details).to.deep.equal({ expected: 'document', received: 'archivo' });
      expect(await listUploads('users')).to.deep.equal([]);
    });

    it('400 UNEXPECTED_FILE_FIELD si se envía más de un archivo', async () => {
      const first = pdfFile('dni-frente.pdf');
      const second = pdfFile('dni-dorso.pdf');
      const res = await api
        .post(`/api/users/${user._id}/documents`)
        .field('documentType', 'ID_CARD')
        .attach('document', first.content, first.options)
        .attach('document', second.content, second.options);

      const body = expectError(res, 400, 'UNEXPECTED_FILE_FIELD');

      expect(body.details).to.deep.equal({ expected: 'document', received: 'document' });
      expect(await listUploads('users')).to.deep.equal([]);
    });

    it('400 INVALID_DOCUMENT_TYPE con un tipo de documento inexistente y borra el archivo', async () => {
      const body = expectError(
        await uploadUserDocument(user._id, pdfFile(), 'PASAPORTE'),
        400,
        'INVALID_DOCUMENT_TYPE'
      );

      expect(body.details).to.deep.equal({ received: 'PASAPORTE', allowed: USER_DOCUMENT_TYPES });
      expect(await listUploads('users')).to.deep.equal([]);
    });

    it('400 INVALID_DOCUMENT_TYPE si no se envía el tipo de documento', async () => {
      const body = expectError(await uploadUserDocument(user._id, pdfFile()), 400, 'INVALID_DOCUMENT_TYPE');

      expect(body.details).to.deep.equal({ received: null, allowed: USER_DOCUMENT_TYPES });
      expect(await listUploads('users')).to.deep.equal([]);
    });

    it('404 USER_NOT_FOUND si el usuario no existe y borra el archivo', async () => {
      const body = expectError(
        await uploadUserDocument(NON_EXISTENT_ID, pdfFile(), 'ID_CARD'),
        404,
        'USER_NOT_FOUND'
      );

      expect(body.details).to.deep.equal({ id: NON_EXISTENT_ID });
      expect(await listUploads('users')).to.deep.equal([]);
    });

    it('409 DOCUMENT_LIMIT_REACHED si el usuario ya tiene 10 documentos y borra el archivo', async () => {
      await UserModel.updateOne({ _id: user._id }, { documents: storedDocuments('users', 'ID_CARD') });

      const body = expectError(await uploadUserDocument(user._id, pdfFile(), 'ID_CARD'), 409, 'DOCUMENT_LIMIT_REACHED');

      expect(body.details).to.deep.equal({ entity: 'user', id: user._id, max: MAX_DOCUMENTS_PER_ENTITY });
      expect(await listUploads('users')).to.deep.equal([]);
      const stored = expectSuccess(await api.get(`/api/users/${user._id}/documents`), 200);
      expect(stored).to.have.lengthOf(MAX_DOCUMENTS_PER_ENTITY);
    });
  });

  describe('GET /api/users/:uid/documents', () => {
    it('lista los metadatos de los documentos del usuario', async () => {
      const user = await createCustomer();
      await uploadUserDocument(user._id, pdfFile('dni.pdf'), 'ID_CARD');
      await uploadUserDocument(user._id, jpgFile('servicio.jpg'), 'PROOF_OF_ADDRESS');

      const payload = expectSuccess(await api.get(`/api/users/${user._id}/documents`), 200);

      expect(payload).to.be.an('array').with.lengthOf(2);
      expect(payload.map((doc) => doc.originalName)).to.deep.equal(['dni.pdf', 'servicio.jpg']);
    });

    it('devuelve una lista vacía si el usuario no tiene documentos', async () => {
      const user = await createCustomer();

      const payload = expectSuccess(await api.get(`/api/users/${user._id}/documents`), 200);

      expect(payload).to.deep.equal([]);
    });

    it('404 USER_NOT_FOUND si el usuario no existe', async () => {
      const body = expectError(await api.get(`/api/users/${NON_EXISTENT_ID}/documents`), 404, 'USER_NOT_FOUND');

      expect(body.details).to.deep.equal({ id: NON_EXISTENT_ID });
    });
  });

  describe('GET /api/users/:uid/documents/:docId/file', () => {
    let user;
    let document;
    const file = pdfFile('dni.pdf');

    beforeEach(async () => {
      user = await createCustomer();
      const payload = expectSuccess(await uploadUserDocument(user._id, file, 'ID_CARD'), 201);
      [document] = payload.documents;
    });

    it('descarga el archivo con su nombre original y exactamente el contenido que se subió', async () => {
      const res = await download(`/api/users/${user._id}/documents/${document._id}/file`);

      expect(res.status).to.equal(200);
      expect(res.headers['content-type']).to.match(/application\/pdf/);
      expect(res.headers['content-disposition']).to.equal('attachment; filename="dni.pdf"');
      // Byte a byte: el archivo descargado es el mismo Buffer que se envió en el POST.
      expect(Number(res.headers['content-length'])).to.equal(file.content.length);
      expect(res.body).to.deep.equal(file.content);
    });

    it('404 DOCUMENT_NOT_FOUND si el documento no es del usuario', async () => {
      const body = expectError(
        await api.get(`/api/users/${user._id}/documents/${NON_EXISTENT_ID}/file`),
        404,
        'DOCUMENT_NOT_FOUND'
      );

      expect(body.details).to.deep.equal({ id: NON_EXISTENT_ID });
    });

    it('404 DOCUMENT_NOT_FOUND si el archivo ya no está en el servidor', async () => {
      await fs.rm(absoluteUploadPath(document.path));

      const body = expectError(
        await api.get(`/api/users/${user._id}/documents/${document._id}/file`),
        404,
        'DOCUMENT_NOT_FOUND'
      );

      expect(body.message).to.include('ya no está disponible');
    });

    it('404 USER_NOT_FOUND si el usuario no existe', async () => {
      expectError(
        await api.get(`/api/users/${NON_EXISTENT_ID}/documents/${document._id}/file`),
        404,
        'USER_NOT_FOUND'
      );
    });
  });

  describe('POST /api/deliveries/:did/proofs', () => {
    let delivery;

    beforeEach(async () => {
      const customer = await createCustomer();
      const courier = await createCourier();
      const order = await createOrder({ customer, status: 'DELIVERED' });
      delivery = await createDelivery({ order, courier });
    });

    it('guarda el comprobante en uploads/deliveries y lo asocia a la entrega (DELIVERY_PHOTO por defecto)', async () => {
      const file = jpgFile('puerta.jpg');

      const payload = expectSuccess(await uploadDeliveryProof(delivery._id, file), 201);

      expect(payload._id).to.equal(delivery._id);
      expect(payload).to.include.all.keys('order', 'courier', 'trackingCode', 'status', 'proofs');
      expect(payload.order).to.be.an('object').that.includes.keys('code', 'status');
      expect(payload.proofs).to.have.lengthOf(1);
      await expectStoredDocument(payload.proofs[0], { file, documentType: 'DELIVERY_PHOTO', folder: 'deliveries' });
      expect(await listUploads('deliveries')).to.deep.equal([payload.proofs[0].fileName]);

      const found = expectSuccess(await api.get(`/api/deliveries/${delivery._id}`), 200);
      expect(found.proofs).to.deep.equal(payload.proofs);
    });

    it('acepta un remito firmado en PDF (tipo en minúsculas)', async () => {
      const file = pdfFile('remito-firmado.pdf');

      const payload = expectSuccess(await uploadDeliveryProof(delivery._id, file, 'signed_receipt'), 201);

      await expectStoredDocument(payload.proofs[0], { file, documentType: 'SIGNED_RECEIPT', folder: 'deliveries' });
    });

    it('400 FILE_REQUIRED si no se envía ningún archivo', async () => {
      const body = expectError(
        await uploadDeliveryProof(delivery._id, null, 'DELIVERY_PHOTO'),
        400,
        'FILE_REQUIRED'
      );

      expect(body.details).to.deep.equal({ field: 'proof' });
    });

    it('400 INVALID_FILE_TYPE con un tipo de archivo no permitido', async () => {
      const body = expectError(await uploadDeliveryProof(delivery._id, gifFile()), 400, 'INVALID_FILE_TYPE');

      expect(body.details.allowed).to.deep.equal(ALLOWED_EXTENSIONS);
      expect(await listUploads('deliveries')).to.deep.equal([]);
    });

    it('400 INVALID_FILE_TYPE si el contenido no corresponde al tipo declarado', async () => {
      const body = expectError(
        await uploadDeliveryProof(delivery._id, pngDisguisedAsJpgFile('puerta.jpg')),
        400,
        'INVALID_FILE_TYPE'
      );

      expect(body.details).to.deep.equal({ fileName: 'puerta.jpg', mimeType: 'image/jpeg', detected: 'image/png' });
      expect(await listUploads('deliveries')).to.deep.equal([]);
    });

    it('413 FILE_TOO_LARGE si el archivo supera los 5 MB', async () => {
      const body = expectError(await uploadDeliveryProof(delivery._id, oversizedPdfFile()), 413, 'FILE_TOO_LARGE');

      expect(body.details).to.deep.equal({ field: 'proof', maxSizeBytes: MAX_FILE_SIZE_BYTES });
      expect(await listUploads('deliveries')).to.deep.equal([]);
    });

    it('400 INVALID_DOCUMENT_TYPE con un tipo de comprobante inexistente y borra el archivo', async () => {
      const body = expectError(
        await uploadDeliveryProof(delivery._id, jpgFile(), 'FACTURA'),
        400,
        'INVALID_DOCUMENT_TYPE'
      );

      expect(body.details).to.deep.equal({ received: 'FACTURA', allowed: DELIVERY_PROOF_TYPES });
      expect(await listUploads('deliveries')).to.deep.equal([]);
    });

    it('404 DELIVERY_NOT_FOUND si la entrega no existe y borra el archivo', async () => {
      const body = expectError(
        await uploadDeliveryProof(NON_EXISTENT_ID, jpgFile()),
        404,
        'DELIVERY_NOT_FOUND'
      );

      expect(body.details).to.deep.equal({ id: NON_EXISTENT_ID });
      expect(await listUploads('deliveries')).to.deep.equal([]);
    });

    it('409 DOCUMENT_LIMIT_REACHED si la entrega ya tiene 10 comprobantes y borra el archivo', async () => {
      await DeliveryModel.updateOne({ _id: delivery._id }, { proofs: storedDocuments('deliveries', 'DELIVERY_PHOTO') });

      const body = expectError(await uploadDeliveryProof(delivery._id, jpgFile()), 409, 'DOCUMENT_LIMIT_REACHED');

      expect(body.details).to.deep.equal({ entity: 'delivery', id: delivery._id, max: MAX_DOCUMENTS_PER_ENTITY });
      expect(await listUploads('deliveries')).to.deep.equal([]);
    });
  });

  describe('GET /api/deliveries/:did/proofs y /proofs/:proofId/file', () => {
    let delivery;
    let proof;
    const file = jpgFile('puerta.jpg');

    beforeEach(async () => {
      const customer = await createCustomer();
      const order = await createOrder({ customer });
      delivery = await createDelivery({ order });
      const payload = expectSuccess(await uploadDeliveryProof(delivery._id, file), 201);
      [proof] = payload.proofs;
    });

    it('lista los comprobantes de la entrega', async () => {
      const payload = expectSuccess(await api.get(`/api/deliveries/${delivery._id}/proofs`), 200);

      expect(payload).to.deep.equal([proof]);
    });

    it('descarga el comprobante con su nombre original y exactamente el contenido que se subió', async () => {
      const res = await download(`/api/deliveries/${delivery._id}/proofs/${proof._id}/file`);

      expect(res.status).to.equal(200);
      expect(res.headers['content-type']).to.match(/image\/jpeg/);
      expect(res.headers['content-disposition']).to.equal('attachment; filename="puerta.jpg"');
      // Byte a byte: el archivo descargado es el mismo Buffer que se envió en el POST.
      expect(Number(res.headers['content-length'])).to.equal(file.content.length);
      expect(res.body).to.deep.equal(file.content);
    });

    it('404 DELIVERY_NOT_FOUND al listar los comprobantes de una entrega inexistente', async () => {
      expectError(await api.get(`/api/deliveries/${NON_EXISTENT_ID}/proofs`), 404, 'DELIVERY_NOT_FOUND');
    });

    it('404 DOCUMENT_NOT_FOUND si el comprobante no es de la entrega', async () => {
      const body = expectError(
        await api.get(`/api/deliveries/${delivery._id}/proofs/${NON_EXISTENT_ID}/file`),
        404,
        'DOCUMENT_NOT_FOUND'
      );

      expect(body.details).to.deep.equal({ id: NON_EXISTENT_ID });
    });
  });

  // Si se borra la entidad, sus archivos no pueden quedar sueltos en uploads/.
  describe('Baja de la entidad dueña de los archivos', () => {
    it('DELETE /api/users/:uid borra también los archivos de sus documentos', async () => {
      const user = await createCustomer();
      await uploadUserDocument(user._id, pdfFile('dni.pdf'), 'ID_CARD');
      await uploadUserDocument(user._id, jpgFile('servicio.jpg'), 'PROOF_OF_ADDRESS');
      expect(await listUploads('users')).to.have.lengthOf(2);

      const res = await api.delete(`/api/users/${user._id}`);

      expect(res.status).to.equal(204);
      expect(await listUploads('users')).to.deep.equal([]);
    });

    it('DELETE /api/mocks/seed borra los archivos de los usuarios y entregas de prueba', async () => {
      const customer = await createCustomer();
      const courier = await createCourier();
      const order = await createOrder({ customer, status: 'DELIVERED' });
      const delivery = await createDelivery({ order, courier });
      await uploadUserDocument(courier._id, pdfFile('licencia.pdf'), 'DRIVER_LICENSE');
      await uploadDeliveryProof(delivery._id, jpgFile('puerta.jpg'));

      const payload = expectSuccess(await api.delete('/api/mocks/seed'), 200);

      expect(payload.eliminados).to.deep.equal({ users: 2, orders: 1, deliveries: 1 });
      expect(await listUploads('users')).to.deep.equal([]);
      expect(await listUploads('deliveries')).to.deep.equal([]);
    });
  });
});
