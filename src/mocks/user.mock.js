import { fakerES as faker } from '@faker-js/faker';
import { USER_ROLES, MOCKS } from '../constants/index.js';

const MIN_AGE = 18;
const MAX_AGE = 75;

// "José María" -> "josemaria": sin tildes, espacios ni símbolos para armar un email válido.
const toEmailPart = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

// Genera un usuario con la misma forma que UserModel. El _id se genera acá
// para poder relacionarlo con pedidos y entregas antes de guardarlo.
export const generateUser = ({ role = faker.helpers.arrayElement(MOCKS.RANDOM_ROLES), passwordHash }) => {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  // El sufijo aleatorio evita choques con el índice único de email.
  const suffix = faker.string.alphanumeric({ length: 5, casing: 'lower' });

  return {
    _id: faker.database.mongodbObjectId(),
    first_name: firstName,
    last_name: lastName,
    email: `${toEmailPart(firstName)}.${toEmailPart(lastName)}.${suffix}@${MOCKS.EMAIL_DOMAIN}`,
    age: faker.number.int({ min: MIN_AGE, max: MAX_AGE }),
    password: passwordHash,
    role,
  };
};

export const generateUsers = (qty, options) => Array.from({ length: qty }, () => generateUser(options));

export const generateCouriers = (qty, { passwordHash }) =>
  generateUsers(qty, { role: USER_ROLES.COURIER, passwordHash });
