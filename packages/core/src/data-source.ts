import { z } from "zod";

export const HttpMethodSchema = z.enum([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);

export type HttpMethod = z.infer<typeof HttpMethodSchema>;

/**
 * API endpoint configuration.
 */
export interface ApiEndpoint {
  /** Request URL (supports :id path params and ${/path} interpolation). */
  url: string;
  /** HTTP method. */
  method: HttpMethod;
  /** Request headers. */
  headers?: Record<string, string>;
  /** Request body source path in data model. */
  bodyPath?: string;
  /** Optional transform expression for response shape adaptation. */
  transform?: string;
}

/**
 * Pagination behavior for list endpoints.
 */
export interface PaginationConfig {
  pageParam?: string;
  pageSizeParam?: string;
  totalPath?: string;
  itemsPath?: string;
}

/**
 * Sort behavior for list endpoints.
 */
export interface SortConfig {
  fieldParam: string;
  orderParam: string;
}

/**
 * Filter behavior for list endpoints.
 */
export interface FilterConfig {
  params: Record<string, string>;
}

/**
 * Data source definition.
 */
export interface DataSource {
  /** Unique source identifier. */
  id: string;
  /** Bound path in the data model. */
  path: string;
  /** Source type. */
  type: "rest" | "graphql" | "mock";
  /** CRUD API definitions. */
  api: {
    list?: ApiEndpoint & {
      pagination?: PaginationConfig;
      sort?: SortConfig;
      filters?: FilterConfig;
    };
    get?: ApiEndpoint;
    create?: ApiEndpoint;
    update?: ApiEndpoint;
    delete?: ApiEndpoint;
  };
  /** Auto fetch behavior. */
  autoFetch?: {
    onMount?: boolean;
    deps?: string[];
    pollingInterval?: number;
  };
  /** Auto refetch events after mutations. */
  refetchOn?: Array<"create" | "update" | "delete">;
  /** Mock data for playground mode. */
  mockData?: {
    list?: unknown[];
    detail?: Record<string, unknown>;
    delay?: number;
  };
}

const ApiEndpointSchema = z.object({
  url: z.string(),
  method: HttpMethodSchema,
  headers: z.record(z.string(), z.string()).optional(),
  bodyPath: z.string().optional(),
  transform: z.string().optional(),
});

const PaginationConfigSchema = z.object({
  pageParam: z.string().optional(),
  pageSizeParam: z.string().optional(),
  totalPath: z.string().optional(),
  itemsPath: z.string().optional(),
});

const SortConfigSchema = z.object({
  fieldParam: z.string(),
  orderParam: z.string(),
});

const FilterConfigSchema = z.object({
  params: z.record(z.string(), z.string()),
});

/**
 * DataSource zod schema.
 */
export const DataSourceSchema: z.ZodType<DataSource> = z.object({
  id: z.string(),
  path: z.string(),
  type: z.enum(["rest", "graphql", "mock"]),
  api: z.object({
    list: ApiEndpointSchema.extend({
      pagination: PaginationConfigSchema.optional(),
      sort: SortConfigSchema.optional(),
      filters: FilterConfigSchema.optional(),
    }).optional(),
    get: ApiEndpointSchema.optional(),
    create: ApiEndpointSchema.optional(),
    update: ApiEndpointSchema.optional(),
    delete: ApiEndpointSchema.optional(),
  }),
  autoFetch: z
    .object({
      onMount: z.boolean().optional(),
      deps: z.array(z.string()).optional(),
      pollingInterval: z.number().optional(),
    })
    .optional(),
  refetchOn: z.array(z.enum(["create", "update", "delete"])).optional(),
  mockData: z
    .object({
      list: z.array(z.unknown()).optional(),
      detail: z.record(z.string(), z.unknown()).optional(),
      delay: z.number().optional(),
    })
    .optional(),
}) as z.ZodType<DataSource>;
