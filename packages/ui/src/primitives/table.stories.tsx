import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { Table, TableHeader, TableBody, Column, Row, Cell } from "./table";

const meta: Meta = {
  title: "Primitives/Table",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

interface Run {
  id: string;
  name: string;
  status: "pass" | "fail" | "pending";
  duration: string;
}

const initialRuns: Run[] = [
  {
    id: "r1",
    name: "stripe_refund_divergence",
    status: "pass",
    duration: "38s",
  },
  {
    id: "r2",
    name: "shopify_out_of_stock_recovery",
    status: "fail",
    duration: "1m 12s",
  },
  {
    id: "r3",
    name: "intercom_rage_click_recovery",
    status: "pending",
    duration: "—",
  },
  { id: "r4", name: "klaviyo_list_drift", status: "pass", duration: "22s" },
];

export const Simple: Story = {
  render: () => (
    <Table aria-label="Runs">
      <TableHeader>
        <Column id="name" isRowHeader>
          Name
        </Column>
        <Column id="status">Status</Column>
        <Column id="duration">Duration</Column>
      </TableHeader>
      <TableBody items={initialRuns}>
        {(row) => (
          <Row id={row.id}>
            <Cell>{row.name}</Cell>
            <Cell>{row.status}</Cell>
            <Cell>{row.duration}</Cell>
          </Row>
        )}
      </TableBody>
    </Table>
  ),
};

export const Sortable: Story = {
  render: () => {
    const [sort, setSort] = React.useState<{
      column: keyof Run;
      direction: "ascending" | "descending";
    }>({ column: "name", direction: "ascending" });
    const rows = React.useMemo(() => {
      const copy = [...initialRuns];
      copy.sort((a, b) => {
        const av = a[sort.column];
        const bv = b[sort.column];
        const cmp = String(av).localeCompare(String(bv));
        return sort.direction === "ascending" ? cmp : -cmp;
      });
      return copy;
    }, [sort]);
    return (
      <Table
        aria-label="Sortable runs"
        selectionMode="multiple"
        sortDescriptor={sort}
        onSortChange={(d) =>
          setSort({
            column: d.column as keyof Run,
            direction: d.direction ?? "ascending",
          })
        }
      >
        <TableHeader>
          <Column id="name" isRowHeader allowsSorting>
            Name
          </Column>
          <Column id="status" allowsSorting>
            Status
          </Column>
          <Column id="duration" allowsSorting>
            Duration
          </Column>
        </TableHeader>
        <TableBody items={rows}>
          {(row) => (
            <Row id={row.id}>
              <Cell>{row.name}</Cell>
              <Cell>{row.status}</Cell>
              <Cell>{row.duration}</Cell>
            </Row>
          )}
        </TableBody>
      </Table>
    );
  },
};
