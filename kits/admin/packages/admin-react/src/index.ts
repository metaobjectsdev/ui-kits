// @metaobjectsdev/admin-react: the shared admin components, the MetaObjects reference component
// set. This is the package's only entry, and every export here is public API: a renamed export or
// a removed prop is a breaking change. Each component emits ak- classes from
// @metaobjectsdev/admin-css; load that stylesheet (after @metaobjectsdev/admin-tokens/tokens.css,
// or use admin.css, which holds both) once per app.
export {
  AdminShell,
  NavGroup,
  NavItem,
  navItemClass,
  type AdminShellProps,
  type NavGroupProps,
  type NavItemProps,
} from './shell.js';
export {
  Card,
  PageHeader,
  Section,
  StatCard,
  StatGrid,
  cardClass,
  type CardProps,
  type PageHeaderProps,
  type SectionProps,
  type StatCardProps,
  type StatGridProps,
} from './page.js';
export {
  Button,
  Field,
  SegmentedControl,
  buttonClass,
  inputClass,
  selectClass,
  textareaClass,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
  type FieldControlProps,
  type FieldProps,
  type SegmentedControlProps,
  type SegmentedOption,
} from './controls.js';
export {
  Alert,
  Badge,
  EmptyState,
  ErrorText,
  Loading,
  Skeleton,
  type AlertProps,
  type AlertTone,
  type BadgeProps,
  type BadgeTone,
  type EmptyKind,
  type EmptyStateProps,
  type ErrorTextProps,
  type LoadingProps,
  type SkeletonProps,
} from './status.js';
export {
  EmptyRow,
  Table,
  Td,
  Th,
  entityGridClasses,
  trClass,
  type EmptyRowProps,
  type TableProps,
  type TdProps,
  type ThProps,
} from './table.js';
export { ConfirmDialog, useConfirm, type ConfirmDialogProps, type ConfirmOptions } from './dialog.js';
export { Toast, ToastProvider, useToast, type ToastOptions, type ToastProps, type ToastProviderProps } from './toast.js';
export {
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  ThemeToggle,
  applyTheme,
  initTheme,
  readTheme,
  setTheme,
  useTheme,
  type Theme,
} from './theme.js';
// Charts: bar, line, sparkline and meter, with the data rules a generator can call directly.
export {
  BarChart,
  ChartTable,
  LineChart,
  formatChartValue,
  xTicks,
  type BarChartProps,
  type ChartProps,
  type ChartTableProps,
} from './charts.js';
export { Meter, Sparkline, type MeterProps, type MeterTone, type SparklineProps } from './inline-charts.js';
export {
  MAX_SERIES,
  OTHER_KEY,
  OTHER_LABEL,
  chartCsv,
  chartDomain,
  checkChartUnits,
  foldSeries,
  isGap,
  niceBound,
  type ChartRow,
  type ChartSeries,
  type ChartUnitCheck,
  type ChartValue,
} from './chart-data.js';

// ─── Layout and data ─────────────────────────────────────
export {
  EXTERNAL_REL,
  MixedMoneyError,
  UNKNOWN_TEXT,
  assertOneMoneyKind,
  formatExactUtc,
  formatMoney,
  formatNumber,
  formatRelative,
  formatUtcDay,
  isUnknown,
  safeHref,
  sumMoney,
  type MoneyAmount,
  type MoneyFormat,
  type MoneyKind,
} from './format.js';
export {
  CopyValue,
  DefinitionList,
  Unknown,
  Value,
  type DefinitionGroup,
  type DefinitionItem,
  type ValueProps,
  type ValueView,
} from './value.js';
export { Drawer, focusableWithin, trapTab, type DrawerProps } from './drawer.js';
export {
  confirmationFor,
  useTieredConfirm,
  type ActionTier,
  type Confirmation,
  type TieredAnswer,
  type TieredConfirmOptions,
} from './dialog.js';
export {
  UrlStateProvider,
  hashParamsAdapter,
  searchParamsAdapter,
  useUrlAdapter,
  useUrlParam,
  useUrlParams,
  type UrlAdapter,
} from './url.js';
export {
  PERIOD_PRESETS,
  currentMonth,
  decodePeriod,
  encodePeriod,
  formatMonth,
  formatRange,
  previousRange,
  resolvePeriod,
  stepMonth,
  type DayRange,
  type Period,
  type PeriodPreset,
} from './period.js';
export {
  FilterBar,
  FilterField,
  FilterSearch,
  FilterSegment,
  FilterSelect,
  PERIOD_LABELS,
  PeriodControl,
  usePeriodParam,
  type FilterOption,
  type PeriodControlProps,
  type PeriodParam,
} from './filters.js';
export { ActionMenu, type MenuAction } from './menu.js';
export { csvCell, downloadCsv } from './csv.js';
export { DataTable, toCsv, type DataColumn, type DataTableProps } from './datatable.js';
export { InlineEditCell, type InlineEditCellProps, type LoadState } from './inline-edit.js';
export { LookupPicker, type LookupOption, type LookupPickerProps } from './lookup.js';
export { FileInput, acceptsFile, formatBytes, type FileInputProps } from './file-input.js';
export { CommandPalette, filterCommands, isTyping, type CommandItem, type CommandPaletteProps } from './palette.js';
export { QueueLayout, type QueueAction, type QueueLayoutProps } from './queue.js';
