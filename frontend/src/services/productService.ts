import api from "./api";

export interface Product {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  organisation: string;
  description?: string;
  label?: string;
  created_at?: string;
}

export interface ProductFilters {
  // pagination
  skip?: number;
  limit?: number;

  // search
  search?: string;
}

export interface ProductListResponse {
  items: Product[];
  pagination: {
    total: number;
    skip: number;
    limit: number;
  };
}

export interface ProductUpdateResponse {
  message: string;
  product_id: string;
  success: boolean;
}

export const productService = {
  async listProducts(
    params: ProductFilters = {},
  ): Promise<ProductListResponse> {
    const response = await api.get("/api/products/all", { params });
    return response.data;
  },

  async createProduct(data: {
    name: string;
    code: string;
    description: string;
  }): Promise<ProductUpdateResponse> {
    const response = await api.post<ProductUpdateResponse>(
      "/api/products/create",
      {
        name: data.name,
        code: data.code,
        description: data.description,
      },
    );
    return response.data;
  },

  async updateUser(
    userId: number,
    data: {
      name: string;
      code: string;
      description: string;
    },
  ): Promise<ProductUpdateResponse> {
    const response = await api.put<ProductUpdateResponse>(
      `/api/products/update/${userId}`,
      data,
    );
    return response.data;
  },

  async deleteUser(productId: number): Promise<void> {
    await api.delete(`/api/products/delete/${productId}`);
  },

  async productLookup(): Promise<Product[]> {
    const response = await api.get<Product[]>("/api/products/lookup");
    return response.data;
  },
};
