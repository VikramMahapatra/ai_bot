export interface SuperAdminProduct {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  organisation: string;

  label?: string;
  created_at?: string;
}

export interface SuperAdminProductFilters {
  // pagination
  skip?: number;
  limit?: number;

  // search
  search?: string;
}

export interface SuperAdminProductListResponse {
  items: SuperAdminProduct[];
  pagination: {
    total: number;
    skip: number;
    limit: number;
  };
}

export interface SuperAdminProductUpdateResponse {
  message: string;
  product_id: string;
  success: boolean;
}

export interface SuperAdminProductFormData {
  name: string;
  code: string;
  isActive: boolean;
}

export interface SuperAdminProductFormErrors {
  name: string;
  code: string;
}
