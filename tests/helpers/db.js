import mongoose from 'mongoose';

export const getDatabaseName = () => mongoose.connection.name;

// Vacía todas las colecciones de la base de testing. Usa deleteMany (y no dropDatabase)
// para conservar los índices, como el de email único.
export const clearDatabase = async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
};
