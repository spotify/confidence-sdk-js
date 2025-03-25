import { ReactElement, ReactNode } from 'react';

const CLIENT_REF = Symbol.for('react.client.reference');

export function OnceRendered(props: { callback: () => void; children: ReactNode }) {
  console.log('render once rendered');
  let pending = 0;
  const unregister = () => {
    if (--pending === 0) {
      console.log('calling callback!!!');
      props.callback();
    }
  };
  const register = (promise: Promise<unknown>) => {
    pending++;
    promise.finally(unregister);
    return promise;
  };
  return wrap(props.children);

  function wrap(node: ReactNode): ReactNode {
    if (node === null || typeof node !== 'object') return node;
    if (isPromiseLike(node)) {
      console.log('node is promise');
      const p = node.then(node => wrap(node));
      register(p);
      return p;
    }
    if (isIterable(node)) {
      // console.log('node is iterable');
      return Array.from(node, node => wrap(node));
    }
    if (isReactElement(node)) {
      const overrides: Partial<ReactElement> = {};
      // console.log('node is element');
      if (typeof node.type === 'function' && node.type.$$typeof !== CLIENT_REF) {
        pending++;
        const func = node.type as any;
        overrides.type = (...args) => {
          console.log('rendering wrapped', node.props.name);
          const result = wrap(func(...args) as ReactNode);
          unregister();
          return result;
        };
        // console.log('node is function', func['$$typeof'], func.prototype?.constructor);
      }
      // if (typeof node.type === 'function' && '$$typeof' in node.type) {
      //   console.log('skipping', node);
      // }
      if (node.props && typeof node.props === 'object' && 'children' in node.props) {
        // console.log('node has children');
        overrides.props = { ...node.props, children: wrap(node.props.children as ReactNode) };
        // wrap(node.props.children as ReactNode);
      }
      return cloneReactElement(node, overrides);
    }
    console.log('node is unknown', node);
    return node;
  }
}

export function render(node: ReactNode): ReactNode {
  if (node === null || typeof node !== 'object') return node;
  if (isPromiseLike(node)) {
    return node.then(render);
  }
  if (isIterable(node)) {
    // console.log('node is iterable');
    return Array.from(node, node => render(node));
  }
  if (isReactElement(node)) {
    const overrides: Partial<ReactElement> = {};
    // console.log('node is element');
    if (typeof node.type === 'function' && node.type.$$typeof !== CLIENT_REF) {
      const func = node.type as any;
      return render(func(node.props));
    }
    if (node.props && typeof node.props === 'object' && 'children' in node.props) {
      // console.log('node has children');
      overrides.props = { ...node.props, children: render(node.props.children as ReactNode) };
      // wrap(node.props.children as ReactNode);
    }
    return cloneReactElement(node, overrides);
  }
  console.log('node is unknown', node);
  return node;
}

function isPromiseLike<T>(value: unknown | PromiseLike<T>): value is PromiseLike<T> {
  return value !== null && typeof value === 'object' && typeof (value as any).then === 'function';
}

function isIterable<T>(value: unknown | Iterable<T>): value is Iterable<T> {
  return value !== null && typeof value === 'object' && typeof (value as any)[Symbol.iterator] === 'function';
}

function isReactElement(value: unknown): value is React.ReactElement {
  return value !== null && typeof value === 'object' && typeof (value as any).$$typeof === 'symbol';
}

function cloneReactElement(elem: ReactElement, overrides: Partial<ReactElement>): ReactElement {
  let descriptors: PropertyDescriptorMap | undefined;
  for (const [key, value] of Object.entries(overrides)) {
    if (!descriptors) {
      descriptors = Object.getOwnPropertyDescriptors(elem);
    }
    // console.log('overriding', key);
    descriptors[key].value = value;
  }
  return descriptors ? Object.create(null, descriptors) : elem;
}
