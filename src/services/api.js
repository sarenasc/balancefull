export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const createApiClient = (baseUrl) => {
  const request = async (path, options = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new ApiError(message || 'Error de API', response.status);
    }

    return response.json();
  };

  return {
    get: (path) => request(path),
    post: (path, body) =>
      request(path, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    put: (path, body) =>
      request(path, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    delete: (path) =>
      request(path, {
        method: 'DELETE',
      }),
  };
};

export const readList = async (client, path) => {
  const rows = await client.get(path);
  return Array.isArray(rows) ? rows : [];
};
