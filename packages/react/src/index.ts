// Contexts
export {
  DataProvider,
  useData,
  useDataValue,
  useDataBinding,
  type DataContextValue,
  type DataProviderProps,
} from "./contexts/data";

export {
  DataSourceProvider,
  useDataSource,
  useOptionalDataSource,
  type DataSourceContextValue,
  type DataSourceProviderProps,
} from "./contexts/data-source";

export {
  MockDataSourceProvider,
  type MockDataSourceProviderProps,
} from "./contexts/mock-data-source";

export {
  VisibilityProvider,
  useVisibility,
  useIsVisible,
  type VisibilityContextValue,
  type VisibilityProviderProps,
} from "./contexts/visibility";

export {
  ActionProvider,
  useActions,
  useAction,
  ConfirmDialog,
  type ActionContextValue,
  type ActionProviderProps,
  type PendingConfirmation,
  type ConfirmDialogProps,
} from "./contexts/actions";

export {
  ValidationProvider,
  useValidation,
  useFieldValidation,
  type ValidationContextValue,
  type ValidationProviderProps,
  type FieldValidationState,
} from "./contexts/validation";

// Renderer
export {
  Renderer,
  JSONUIProvider,
  createRendererFromCatalog,
  type ComponentRenderProps,
  type ComponentRenderer,
  type ComponentRegistry,
  type RendererProps,
  type JSONUIProviderProps,
} from "./renderer";

// Hooks
export {
  useUIStream,
  flatToTree,
  type UIStreamRuntimePayload,
  type UseUIStreamOptions,
  type UseUIStreamReturn,
} from "./hooks";
