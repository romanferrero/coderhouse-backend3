import request from 'supertest';
import app from '../../src/app.js';

// Supertest recibe la app de Express (sin server.js): levanta un servidor en un puerto
// temporal para cada request y lo cierra al terminar. No hace falta conocer el PORT.
export const api = request(app);
