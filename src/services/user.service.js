import bcrypt from 'bcryptjs';
import userRepository from '../repositories/user.repository.js';
import documentService from './document.service.js';
import logger from '../logger/index.js';
import { USER_ROLES, USER_DOCUMENT_TYPES, PASSWORD_SALT_ROUNDS } from '../constants/index.js';
import {
  InvalidDataError,
  InvalidFieldTypeError,
  InvalidRoleError,
  MissingFieldsError,
  BlankFieldsError,
  NoFieldsToUpdateError,
  UserNotFoundError,
  EmailAlreadyRegisteredError,
  LastAdminError,
} from '../errors/index.js';
import { pick } from '../utils/pick.js';
import { findBlankFields, findBlankProvidedFields, findNonStringFields } from '../utils/validation.js';
import { normalizePagination, buildPaginatedResult } from '../utils/pagination.js';

const CREATE_FIELDS = ['first_name', 'last_name', 'email', 'age', 'password'];
const UPDATE_FIELDS = CREATE_FIELDS;
const REQUIRED_FIELDS = ['first_name', 'last_name', 'email', 'password'];
const TEXT_FIELDS = ['first_name', 'last_name', 'email', 'password'];
const VALID_ROLES = Object.values(USER_ROLES);
const VALID_DOCUMENT_TYPES = Object.values(USER_DOCUMENT_TYPES);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

class UserService {
  constructor({ repository, documents }) {
    this.repository = repository;
    this.documents = documents;
  }

  // Los campos de texto tienen que llegar como string: un array u objeto no es un valor válido
  // y, sin este control, terminaría en un 500 o llegaría tal cual a las consultas de MongoDB.
  validateTextFields(data) {
    const invalid = findNonStringFields(data, TEXT_FIELDS);
    if (invalid.length > 0) throw new InvalidFieldTypeError(invalid);
  }

  validateFields({ email, password, age }) {
    if (email !== undefined && !EMAIL_REGEX.test(email)) {
      throw new InvalidDataError('El email no tiene un formato válido.', { field: 'email' });
    }
    if (password !== undefined && String(password).length < MIN_PASSWORD_LENGTH) {
      throw new InvalidDataError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`, {
        field: 'password',
      });
    }
    if (age !== undefined && (!Number.isInteger(age) || age < 0)) {
      throw new InvalidDataError('La edad debe ser un número entero mayor o igual a 0.', { field: 'age' });
    }
  }

  validateRole(role) {
    if (!VALID_ROLES.includes(role)) {
      throw new InvalidRoleError(role, VALID_ROLES);
    }
  }

  hashPassword(password) {
    return bcrypt.hash(String(password), PASSWORD_SALT_ROUNDS);
  }

  // Regla de negocio: el sistema nunca puede quedarse sin administradores.
  async ensureNotLastAdmin(user) {
    if (user.role !== USER_ROLES.ADMIN) return;
    const admins = await this.repository.countByRole(USER_ROLES.ADMIN);
    if (admins <= 1) {
      throw new LastAdminError();
    }
  }

  async getUsers({ page, limit, role } = {}) {
    const filter = {};
    if (role) {
      const normalizedRole = String(role).toUpperCase();
      this.validateRole(normalizedRole);
      filter.role = normalizedRole;
    }

    const pagination = normalizePagination({ page, limit });
    const { docs, total } = await this.repository.findAll({ filter, ...pagination });
    return buildPaginatedResult({ docs, total, ...pagination });
  }

  async getUserById(id) {
    const user = await this.repository.findById(id);
    if (!user) throw new UserNotFoundError(id);
    return user;
  }

  // Todo usuario nuevo se registra como USER; el rol se cambia con changeRole.
  async createUser(payload) {
    const data = pick(payload, CREATE_FIELDS);

    const missing = findBlankFields(data, REQUIRED_FIELDS);
    if (missing.length > 0) {
      throw new MissingFieldsError(missing);
    }
    this.validateTextFields(data);
    this.validateFields(data);

    if (await this.repository.existsByEmail(data.email)) {
      throw new EmailAlreadyRegisteredError(data.email);
    }

    data.password = await this.hashPassword(data.password);
    data.role = USER_ROLES.USER;
    const user = await this.repository.create(data);
    logger.info(`Usuario registrado: ${user._id}`);
    return user;
  }

  async updateUser(id, payload) {
    const data = pick(payload, UPDATE_FIELDS);
    if (Object.keys(data).length === 0) {
      throw new NoFieldsToUpdateError(UPDATE_FIELDS);
    }

    const blank = findBlankProvidedFields(data, REQUIRED_FIELDS);
    if (blank.length > 0) {
      throw new BlankFieldsError(blank);
    }
    this.validateTextFields(data);
    this.validateFields(data);

    await this.getUserById(id);

    if (data.email && (await this.repository.existsByEmail(data.email, id))) {
      throw new EmailAlreadyRegisteredError(data.email);
    }

    if (data.password) data.password = await this.hashPassword(data.password);
    return this.repository.updateById(id, data);
  }

  async changeRole(id, role) {
    const normalizedRole = role ? String(role).toUpperCase() : undefined;
    this.validateRole(normalizedRole);

    const user = await this.getUserById(id);
    if (user.role === normalizedRole) return user;
    await this.ensureNotLastAdmin(user);

    const updated = await this.repository.updateById(id, { role: normalizedRole });
    logger.info(`Rol del usuario ${id} cambiado de ${user.role} a ${normalizedRole}`);
    return updated;
  }

  // ---------- Documentos ----------

  // Multer ya guardó el archivo y validó su tipo y tamaño. Acá se valida el tipo de documento y que
  // el usuario exista, y se registran los metadatos en el usuario. Si algo falla, el archivo se borra.
  async addDocument(id, { file, documentType }) {
    try {
      const type = this.documents.parseDocumentType(documentType, VALID_DOCUMENT_TYPES);
      await this.getUserById(id);

      const metadata = this.documents.buildMetadata(file, type);
      const user = await this.documents.persist(() => this.repository.addDocument(id, metadata));
      if (!user) throw new UserNotFoundError(id);

      logger.info(`Documento ${type} cargado para el usuario ${id}: ${this.documents.describe(metadata)}`);
      return user;
    } catch (error) {
      await this.documents.discard(file);
      throw error;
    }
  }

  async getDocuments(id) {
    const user = await this.getUserById(id);
    return user.documents ?? [];
  }

  async getDocumentFile(id, documentId) {
    const user = await this.getUserById(id);
    return this.documents.getFile(user.documents, documentId);
  }

  async deleteUser(id) {
    const user = await this.getUserById(id);
    await this.ensureNotLastAdmin(user);
    await this.repository.deleteById(id);
    logger.info(`Usuario eliminado: ${id}`);
    // Sin el usuario, sus documentos quedarían en uploads/ sin entidad.
    await this.documents.removeFiles(user.documents);
  }
}

export default new UserService({ repository: userRepository, documents: documentService });
