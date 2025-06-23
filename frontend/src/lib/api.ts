const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function apiRequest(
  method: string,
  endpoint: string,
  data?: any,
  options: RequestInit = {}
): Promise<any> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Include cookies for session management
    ...options,
  };

  if (data && method !== 'GET') {
    config.body = JSON.stringify(data);
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth
  login: (data: any) => apiRequest('POST', '/api/auth/login', data),
  logout: () => apiRequest('POST', '/api/auth/logout'),
  getUser: () => apiRequest('GET', '/api/auth/user'),

  // Products
  getProducts: (params?: any) => {
    const searchParams = params ? `?${new URLSearchParams(params)}` : '';
    return apiRequest('GET', `/api/products${searchParams}`);
  },
  getProduct: (id: number) => apiRequest('GET', `/api/products/${id}`),
  createProduct: (data: any) => apiRequest('POST', '/api/products', data),
  updateProduct: (id: number, data: any) => apiRequest('PUT', `/api/products/${id}`, data),
  deleteProduct: (id: number) => apiRequest('DELETE', `/api/products/${id}`),

  // Categories
  getCategories: () => apiRequest('GET', '/api/categories'),

  // Cart
  getCart: () => apiRequest('GET', '/api/cart'),
  addToCart: (data: any) => apiRequest('POST', '/api/cart', data),
  updateCartItem: (id: number, data: any) => apiRequest('PUT', `/api/cart/${id}`, data),
  removeFromCart: (id: number) => apiRequest('DELETE', `/api/cart/${id}`),
  clearCart: () => apiRequest('DELETE', '/api/cart'),

  // Orders
  createOrder: (data: any) => apiRequest('POST', '/api/orders', data),
  getOrders: () => apiRequest('GET', '/api/orders'),
  getOrder: (id: number) => apiRequest('GET', `/api/orders/${id}`),

  // Contact
  sendMessage: (data: any) => apiRequest('POST', '/api/contact', data),
  getMessages: () => apiRequest('GET', '/api/contact'),

  // Admin
  getAdminStats: () => apiRequest('GET', '/api/admin/stats'),
}; 