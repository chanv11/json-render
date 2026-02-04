// Types
export type {
  DynamicValue,
  DynamicString,
  DynamicNumber,
  DynamicBoolean,
  UIElement,
  UITree,
  VisibilityCondition,
  LogicExpression,
  AuthState,
  DataModel,
  ComponentSchema,
  ValidationMode,
  PatchOp,
  JsonPatch,
} from "./types";

export {
  DynamicValueSchema,
  DynamicStringSchema,
  DynamicNumberSchema,
  DynamicBooleanSchema,
  resolveDynamicValue,
  getByPath,
  setByPath,
} from "./types";

// Visibility
export type { VisibilityContext } from "./visibility";

export {
  VisibilityConditionSchema,
  LogicExpressionSchema,
  evaluateVisibility,
  evaluateLogicExpression,
  visibility,
} from "./visibility";

// Actions
export type {
  Action,
  ActionConfirm,
  ActionOnSuccess,
  ActionOnError,
  ActionRuntimeContext,
  ActionHandler,
  ActionHandlerContext,
  ActionDefinition,
  GeneratedActionDefinition,
  ResolvedAction,
  ActionExecutionContext,
} from "./actions";

export {
  ActionSchema,
  ActionCallbackSchema,
  ActionConfirmSchema,
  ActionOnSuccessSchema,
  ActionOnErrorSchema,
  GeneratedActionDefinitionSchema,
  resolveAction,
  executeAction,
  interpolateString,
  action,
} from "./actions";

// Validation
export type {
  ValidationCheck,
  ValidationConfig,
  ValidationFunction,
  ValidationFunctionDefinition,
  ValidationCheckResult,
  ValidationResult,
  ValidationContext,
} from "./validation";

export {
  ValidationCheckSchema,
  ValidationConfigSchema,
  builtInValidationFunctions,
  runValidationCheck,
  runValidation,
  check,
} from "./validation";

// Catalog
export type {
  ComponentDefinition,
  CatalogConfig,
  Catalog,
  InferCatalogComponentProps,
  SystemPromptOptions,
} from "./catalog";

export {
  createCatalog,
  generateCatalogPrompt,
  generateSystemPrompt,
} from "./catalog";

// Data source
export type {
  HttpMethod,
  ApiEndpoint,
  PaginationConfig,
  SortConfig,
  FilterConfig,
  DataSource,
} from "./data-source";

export { HttpMethodSchema, DataSourceSchema } from "./data-source";
