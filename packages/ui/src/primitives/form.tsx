"use client";

/*
 * Form — styled native `<form>`.
 *
 *   <Form onSubmit={...}>
 *     <FormField label="Email" ...>
 *       <Input name="email" type="email" required />
 *     </FormField>
 *     <Button type="submit">Submit</Button>
 *   </Form>
 */

import * as React from "react";
import { cva } from "class-variance-authority";

export const formVariants = cva("flex flex-col gap-s-4");

export interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  className?: string;
}

export function Form({ className, children, ...rest }: FormProps) {
  return (
    <form {...rest} className={formVariants({ className })}>
      {children}
    </form>
  );
}
