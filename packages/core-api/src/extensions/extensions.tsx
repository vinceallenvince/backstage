/*
 * Copyright 2020 Spotify AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { lazy, Suspense } from 'react';
import { RouteRef } from '../routing';
import { attachComponentData } from './componentData';
import { Extension, BackstagePlugin } from '../plugin/types';

type ComponentLoader<T> =
  | {
      lazy: () => Promise<T | { default: T }>;
    }
  | {
      sync: T;
    };

export function createRoutableExtension<
  T extends (props: any) => JSX.Element
>(options: {
  component: () => Promise<T | { default: T }>;
  mountPoint: RouteRef;
}): Extension<T> {
  const { component, mountPoint } = options;
  return createReactExtension({
    component: {
      lazy: component,
    },
    data: {
      'core.mountPoint': mountPoint,
    },
  });
}

export function createComponentExtension<
  T extends (props: any) => JSX.Element
>(options: { component: ComponentLoader<T> }): Extension<T> {
  const { component } = options;
  return createReactExtension({ component });
}

export function createReactExtension<
  T extends (props: any) => JSX.Element
>(options: {
  component: ComponentLoader<T>;
  data?: Record<string, unknown>;
}): Extension<T> {
  const { data = {} } = options;

  let Component: T;
  if ('lazy' in options.component) {
    const lazyLoader = options.component.lazy;
    Component = (lazy(() =>
      lazyLoader().then(m => (typeof m === 'object' ? m : { default: m })),
    ) as unknown) as T;
  } else {
    Component = options.component.sync;
  }
  const componentName =
    (Component as { displayName?: string }).displayName ||
    Component.name ||
    'Component';

  return {
    expose(plugin: BackstagePlugin<any, any>) {
      const Result: any = (props: any) => (
        <Suspense fallback="...">
          <Component {...props} />
        </Suspense>
      );

      attachComponentData(Result, 'core.plugin', plugin);
      for (const [key, value] of Object.entries(data)) {
        attachComponentData(Result, key, value);
      }

      Result.displayName = `Extension(${componentName})`;
      return Result;
    },
  };
}
