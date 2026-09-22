import express from 'express';
import apiRouter from './routes/index.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
