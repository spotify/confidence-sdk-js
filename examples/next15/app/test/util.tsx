import React, { ReactElement, ReactNode } from 'react';

const CLIENT_REF = Symbol.for('react.client.reference');

export function OnceRendered(props: { callback: () => void; children: ReactNode }) {
  console.log('render once rendered');
  const wrappedComponents = new WeakMap<ReactServerComponent, ReactServerComponent>();
  let done = false;
  let pending = 0;
  const unregister = () => {
    if (--pending === 0) {
      console.log('calling callback!!!');
      done = true;
      props.callback();
    }
  };
  const register = (promise: Promise<ReactNode>) => {
    if (!done) {
      pending++;
      promise.finally(unregister);
    }
    return promise as ReactNode;
  };
  return wrap(props.children);

  function wrap(node: ReactNode): ReactNode {
    if (node === null || typeof node !== 'object') return node;
    if (isPromiseLike(node)) {
      console.log('node is promise');
      return register(node.then(node => wrap(node)));
    }
    if (isIterable(node)) {
      // console.log('node is iterable');
      return Array.from(node, node => wrap(node));
    }
    if (isReactElement(node)) {
      if (isReactServerComponent(node)) {
        pending++;
        let wrappedComp = wrappedComponents.get(node.type);
        if (!wrappedComp) {
          wrappedComp = (...args) => {
            const result = wrap(node.type(...args));
            unregister();
            return result;
          };
          wrappedComponents.set(node.type, wrappedComp);
        }
        return cloneReactElement(node, wrappedComp);
      } else if (hasChildren(node)) {
        return cloneWithChildren(node, wrap(node.props.children));
      }
    }
    return node;
  }
}

type ReactServerComponent = (props: any) => ReactNode;
type ElementWithChildren = ReactElement & { props: { children: ReactNode } };

function isPromiseLike<T>(value: object | PromiseLike<T>): value is PromiseLike<T> {
  return typeof (value as any).then === 'function';
}

function isIterable<T>(value: object | Iterable<T>): value is Iterable<T> {
  return typeof (value as any)[Symbol.iterator] === 'function';
}

function isReactElement(value: object): value is React.ReactElement {
  return typeof (value as any).$$typeof === 'symbol';
}

function isReactServerComponent(
  value: ReactElement,
): value is Omit<ReactElement, 'type'> & { type: ReactServerComponent } {
  return typeof value.type === 'function' && (value.type as any).$$typeof !== CLIENT_REF;
}

function hasChildren(value: ReactElement): value is ReactElement & { props: { children: ReactNode } } {
  return value.props !== null && typeof value.props === 'object' && 'children' in value.props;
}

function cloneReactElement(elem: ReactElement, typeOverride: ReactElement['type']): ReactElement {
  const descriptors = Object.getOwnPropertyDescriptors(elem);
  descriptors.type.value = typeOverride;
  return Object.create(null, descriptors);
}
function cloneWithChildren(elem: ElementWithChildren, children: ReactNode): ReactElement {
  const descriptors = Object.getOwnPropertyDescriptors(elem);
  const props = descriptors.props.value;
  descriptors.props.value = { ...props, children };
  return Object.create(null, descriptors);
}
