import { PAGINATION } from '../constants/index.js';

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const normalizePagination = ({ page, limit } = {}) => ({
  page: toPositiveInt(page, 1),
  limit: Math.min(toPositiveInt(limit, PAGINATION.DEFAULT_LIMIT), PAGINATION.MAX_LIMIT),
});

export const buildPaginatedResult = ({ docs, total, page, limit }) => {
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  return {
    docs,
    total,
    page,
    limit,
    totalPages,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
  };
};
