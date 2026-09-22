import bcrypt from 'bcryptjs';
import userRepository from '../repositories/user.repository.js';
import { USER_ROLES, PASSWORD_SALT_ROUNDS } from '../constants/index.js';
import AppError from '../utils/AppError.js';
import { pick } from '../utils/pick.js';
import { normalizePagination, buildPaginatedResult } from '../utils/pagination.js';

const CREATE_FIELDS = ['first_name', 'last_name', 'email', 'age', 'password'];
const UPDATE_FIELDS = CREATE_FIELDS;
const REQUIRED_FIELDS = ['first_name', 'last_name', 'email', 'password'];
const VALID_ROLES = Object.values(USER_ROLES);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

class UserService {
  constructor(repository) {
    this.repository = repository;
  }

  validateFields({ email, password, age }) {
    if (email !== undefined && !EMAIL_REGEX.test(email)) {
      throw AppError.badRequest('El email no tiene un formato válido.');
    }
    if (password !== undefined && String(password).length < MIN_PASSWORD_LENGTH) {
      throw AppError.badRequest(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }
    if (age !== undefined && (!Number.isInteger(age) || age < 0)) {
      throw AppError.badRequest('La edad debe ser un número entero mayor o igual a 0.');
    }
  }

  validateRole(role) {
    if (!VALID_ROLES.includes(role)) {
      throw AppError.badRequest(`Rol inválido. Valores permitidos: ${VALID_ROLES.join(', ')}.`);
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
      throw AppError.conflict('No se puede quitar o eliminar al último usuario ADMIN.');
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
    if (!user) throw AppError.notFound(`Usuario con id "${id}" no encontrado.`);
    return user;
  }

  // Todo usuario nuevo se registra como USER; el rol se cambia con changeRole.
  async createUser(payload) {
    const data = pick(payload, CREATE_FIELDS);

    const missing = REQUIRED_FIELDS.filter((field) => data[field] === undefined || data[field] === '');
    if (missing.length > 0) {
      throw AppError.badRequest(`Faltan campos obligatorios: ${missing.join(', ')}.`);
    }
    this.validateFields(data);

    if (await this.repository.existsByEmail(data.email)) {
      throw AppError.conflict(`El email "${data.email}" ya está registrado.`);
    }

    data.password = await this.hashPassword(data.password);
    data.role = USER_ROLES.USER;
    return this.repository.create(data);
  }

  async updateUser(id, payload) {
    const data = pick(payload, UPDATE_FIELDS);
    if (Object.keys(data).length === 0) {
      throw AppError.badRequest(`No se enviaron campos para actualizar. Permitidos: ${UPDATE_FIELDS.join(', ')}.`);
    }
    this.validateFields(data);

    await this.getUserById(id);

    if (data.email && (await this.repository.existsByEmail(data.email, id))) {
      throw AppError.conflict(`El email "${data.email}" ya está registrado.`);
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

    return this.repository.updateById(id, { role: normalizedRole });
  }

  async deleteUser(id) {
    const user = await this.getUserById(id);
    await this.ensureNotLastAdmin(user);
    await this.repository.deleteById(id);
  }
}

export default new UserService(userRepository);
