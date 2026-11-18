import { render, screen } from '@testing-library/react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyRow,
  EmptyState,
  Field,
  PageHeader,
  Section,
  SegmentedControl,
  Skeleton,
  StatCard,
  StatGrid,
  Table,
  Td,
  Th,
  inputClass,
  selectClass,
  textareaClass,
  type AlertProps,
  type BadgeProps,
  type ButtonProps,
  type CardProps,
  type EmptyRowProps,
  type EmptyStateProps,
  type FieldProps,
  type PageHeaderProps,
  type SectionProps,
  type SegmentedControlProps,
  type SkeletonProps,
  type StatCardProps,
  type StatGridProps,
  type TableProps,
  type TdProps,
  type ThProps,
} from '../src/index.js';
import * as index from '../src/index.js';

// The component index is public API that MetaObjects' generated forms and grids build on: a
// removed or renamed export is a breaking change. This pins the names a generator relies on.
describe('component index', () => {
  it('exports the components and class helpers a generated form or grid uses', () => {
    const components = [
      'AdminShell', 'NavGroup', 'NavItem', 'PageHeader', 'Section', 'Card', 'StatGrid', 'StatCard',
      'Button', 'Field', 'SegmentedControl', 'Badge', 'Alert', 'ErrorText', 'Loading', 'Skeleton', 'EmptyState',
      'Table', 'Th', 'Td', 'EmptyRow', 'DataTable', 'Value', 'DefinitionList', 'Drawer', 'ConfirmDialog',
      'FilterBar', 'LookupPicker', 'InlineEditCell', 'FileInput',
    ];
    for (const name of components) expect(typeof (index as Record<string, unknown>)[name], name).toBe('function');
    expect([inputClass, selectClass, textareaClass]).toEqual(['ak-input', 'ak-select', 'ak-textarea']);
  });

  it('exports a props type for each component, usable to type a generated wrapper', () => {
    const header: PageHeaderProps = { title: 'Contacts' };
    const section: SectionProps = { title: 'Details', children: null };
    const card: CardProps = { title: 'Card', children: null };
    const grid: StatGridProps = { cols: 4, children: null };
    const stat: StatCardProps = { label: 'Total', value: 3 };
    const button: ButtonProps = { variant: 'primary' };
    const field: FieldProps = { label: 'Name', children: <input /> };
    const badge: BadgeProps = { children: 'New' };
    const alert: AlertProps = { tone: 'danger', children: 'No' };
    const skeleton: SkeletonProps = { lines: 2 };
    const empty: EmptyStateProps = { kind: 'all-clear' };
    const table: TableProps = { children: null };
    const th: ThProps = { align: 'right' };
    const td: TdProps = { num: true };
    const row: EmptyRowProps = { cols: 2, children: 'None' };
    const seg: SegmentedControlProps<'a' | 'b'> = { label: 'Pick', options: [{ value: 'a', label: 'A' }], value: 'a', onChange: () => {} };

    render(
      <>
        <PageHeader {...header} />
        <Section {...section} />
        <Card {...card} />
        <StatGrid {...grid}>
          <StatCard {...stat} />
        </StatGrid>
        <Button {...button}>Go</Button>
        <Field {...field} />
        <Badge {...badge} />
        <Alert {...alert} />
        <Skeleton {...skeleton} />
        <EmptyState {...empty} />
        <Table {...table}>
          <thead><tr><Th {...th}>H</Th></tr></thead>
          <tbody><tr><Td {...td}>1</Td></tr><EmptyRow {...row} /></tbody>
        </Table>
        <SegmentedControl {...seg} />
      </>,
    );
    expect(screen.getByRole('heading', { name: 'Contacts' })).toBeTruthy();
  });
});
