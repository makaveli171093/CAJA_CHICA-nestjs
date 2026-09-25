import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Envía cookies HttpOnly de sesión automáticamente
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest', // Encabezado estándar para mitigación CSRF
  },
});

// Interceptor para manejar errores 401 (sesión expirada o no autorizada)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Notificar o permitir que el AuthContext maneje la expiración
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);
