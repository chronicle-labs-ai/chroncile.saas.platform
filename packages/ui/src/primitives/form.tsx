"use client";

/*
 * Form — RAC wrapper around `<form>` that hooks into React Aria's
 * validation pipeline. Server-side errors flow in via `validationErrors`,
 * field-level errors propagate to `<FieldError>`, and browser-native
 * constraint validation is respected by default.
 *
 *   <Form onSubmit={...} validationErrors={serverErrors}>
 *     <FormField label="Email" ...>
 *       <Input name="email" type="email" isRequired />
 *     </FormField>
 *     <Button type="submit">Submit</Button>
 *   </Form>
 */

import * as React from "react";
import {
  Form as RACForm,
  type FormProps as RACFormProps,
} from "react-aria-components";

import { cx } from "../utils/cx";

export interface FormProps extends RACFormProps {
  className?: string;
}

export function Form({ className, children, ...rest }: FormProps) {
  return (
    <RACForm {...rest} className={cx("flex flex-col gap-s-4", className)}>
      {children}
    </RACForm>
  );
}
