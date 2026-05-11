/*
 * Polymorphic DOM element proxy.
 *
 * Ported from https://github.com/heroui-inc/heroui/blob/v3/packages/react/src/utils/dom.tsx
 * (MIT), with local ref/effect helpers to keep this package dependency-light.
 *
 * `dom.button`, `dom.a`, `dom.span`, etc. return memoized `forwardRef`
 * components that accept an optional `render?: (props, state) => ReactElement`
 * escape hatch for polymorphism (e.g. rendering as a Next.js `<Link>` while
 * keeping the behavioral contract of a `<button>`). Only one root element may
 * be returned from `render`, and callers MUST pass through `ref` + spread
 * `props` onto the underlying DOM node — the dev-mode warning below checks
 * that the ref actually connected.
 */

"use client";

/* eslint-disable no-console, react-refresh/only-export-components */

import type { AllHTMLAttributes, ForwardedRef, ReactElement, JSX } from "react";

import React, { createElement, forwardRef, useMemo, useRef } from "react";

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref) {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (value: T | null) => {
    refs.forEach((ref) => assignRef(ref, value));
  };
}

const useIsoLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

export type DOMRenderFunction<
  E extends keyof JSX.IntrinsicElements,
  T = unknown,
> = (props: JSX.IntrinsicElements[E], renderProps: T) => ReactElement;

export interface DOMRenderProps<
  E extends keyof JSX.IntrinsicElements,
  T = unknown,
> {
  /**
   * Overrides the default DOM element with a custom render function.
   * This allows rendering existing components with built-in styles and
   * behaviors such as router links, animation libraries, and pre-styled
   * components.
   *
   * Requirements:
   *
   * - Render the expected element type (e.g. if `<button>` is expected, do
   *   not render an `<a>`).
   * - Only a single root DOM element can be rendered (no fragments).
   * - Pass through props and ref to the underlying DOM element, merging with
   *   your own props as appropriate.
   */
  render?: DOMRenderFunction<E, T>;
}

function DOMElement<E extends keyof JSX.IntrinsicElements>(
  ElementType: E,
  props: DOMRenderProps<E> & AllHTMLAttributes<HTMLElement>,
  forwardedRef: ForwardedRef<HTMLElement>
) {
  const { render, ...otherProps } = props;
  const elementRef = useRef<HTMLElement | null>(null);
  const ref = useMemo(
    () => mergeRefs(forwardedRef, elementRef),
    [forwardedRef, elementRef]
  );

  useIsoLayoutEffect(() => {
    if (
      typeof process !== "undefined" &&
      process.env?.["NODE_ENV"] !== "production" &&
      render
    ) {
      if (!elementRef.current) {
        console.warn(
          "Ref was not connected to DOM element returned by custom `render` function. Did you forget to pass through or merge the `ref`?"
        );
      }
    }
  }, [ElementType, render]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const domProps: any = { ...otherProps, ref };

  if (render) {
    return render(domProps, undefined);
  }

  return createElement(ElementType, domProps);
}

type DOMComponents = {
  [E in keyof JSX.IntrinsicElements]: (
    props: DOMRenderProps<E> & JSX.IntrinsicElements[E]
  ) => ReactElement;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const domComponentCache: Record<string, any> = {};

/**
 * Dynamically generates and caches components for each DOM element.
 * Access like `dom.button`, `dom.a`, `dom.span`.
 */
export const dom = new Proxy(
  {},
  {
    get(_target, elementType) {
      if (typeof elementType !== "string") {
        return undefined;
      }

      let res = domComponentCache[elementType];

      if (!res) {
        res = forwardRef(
          DOMElement.bind(
            null,
            elementType as keyof JSX.IntrinsicElements
          ) as never
        );
        domComponentCache[elementType] = res;
      }

      return res;
    },
  }
) as DOMComponents;
