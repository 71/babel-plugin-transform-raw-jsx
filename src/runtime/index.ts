import * as Rx from 'rxjs'


/**
 * Defines an observable stream that notifies subscribers of a change of a value.
 */
export class Observable<T> implements Rx.Subscribable<T> {
  private val: T
  private readonly observers: Rx.PartialObserver<T>[]

  constructor(value: T) {
    this.observers = []

    this.setUnderlyingValue(value)
  }

  /**
   * Sets the underlying value without notifying subscribers of the change.
   */
  setUnderlyingValue(value: T) {
    this.val = value
  }

  /** Gets or sets the underlying value.
   *
   * - When getting the value, only the last version is returned.
   * - When setting the value, also notifies all subscribers of the change.
   */
  get value() {
    return this.val
  }

  set value(value: T) {
    this.setUnderlyingValue(value)

    for (let i = 0; i < this.observers.length; i++)
      this.observers[i].next(value)
  }

  /**
   * Returns the string representation of the underlying value.
   */
  toString() {
    return this.val ? this.val.toString() : undefined
  }

  /**
   * Subcribes to this reactive value.
   */
  subscribe(
    next    ?: Rx.PartialObserver<T> | ((value: T) => void),
    error   ?: (error: any) => void,
    complete?: () => void,
  ): Rx.Unsubscribable {
    const observer: Rx.PartialObserver<T> = typeof next == 'function'
      ? { next, error, complete }
      : next

    this.observers.push(observer)

    return {
      unsubscribe: () => {
        this.observers.splice(this.observers.indexOf(observer), 1)
      }
    }
  }

  /**
   * @see subscribe
   */
  observe(...args) {
    return this.subscribe(...args)
  }
}

/**
 * {T} if {T} is {Observable}, and {Observable<T>} otherwise.
 */
export type Obs<T> = T extends Observable<infer _> ? T : Observable<T>

/**
 * {T} or {Observable<T>}.
 */
export type ObservableLike<T> = T | Observable<T>

/**
 * A component function.
 */
export type Component<P = {}, E extends Node = Element> = (props: P) => E

/**
 * An arbitrarily nested `Node` list.
 */
export type NestedNode =
  | Node
  | ((parent: Element, inserted: Node[], insertionPoint: Node) => void)
  | (() => Node)
  | { [i: number]: NestedNode }

/**
 * Creates an {HTMLElement}, given its tag and attributes.
 *
 * @param tag The HTML tag of the element to create.
 * @param attrs An optional object that contains attributes that
 *   will be set on the created element.
 *
 * @returns The corresponding HTML element.
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag  : K,
  attrs: Partial<HTMLElementTagNameMap[K]>
): HTMLElementTagNameMap[K]

/**
 * Creates an {HTMLElement}, given its component, attributes and children.
 *
 * @param tag The component of the element to create.
 * @param attrs An optional object that contains attributes and properties that
 *   will be set on the created element.
 *
 * @returns The corresponding HTML element.
 */
export function createElement<K extends (props: object) => Element>(
  component: K,
  attrs    : K extends (props: infer A) => infer E ? A & Partial<E> : never,
  ...children: Node[]
): ReturnType<K>

export function createElement(
  tag  : string | ((props: object) => Element),
  attrs: object,
  ...children: NestedNode[]
): Element {
  attrs = attrs || {}

  const isIntrinsic = typeof tag == 'string'
  const el = isIntrinsic
    ? document.createElement(tag as keyof HTMLElementTagNameMap)
    : (tag as (props: {}) => HTMLElement)(attrs)

  if (isIntrinsic) {
    // This is an intrinsic element, so we just copy
    // the attributes.
    for (let attr in attrs) {
      let value = attrs[attr]

      if (value == null)
        continue

      const setValue = (value) => {
        if (attr == 'class')
          el.classList.add(...value.split(' '))
        else if (attr == 'style')
          Object.assign(el.style, value)
        else
          el[attr] = value
      }

      if (attr == 'class')
        attr = 'className'

      let isObs = isObservable(value)

      setValue(isObs ? value.value : value)

      if (isObs)
        value.subscribe(x => setValue(x.value))
    }
  } else {
    // This is a component, so we only pass it the attributes
    for (let attr in attrs) {
      let value = attrs[attr]

      if (!isObservable(value))
        attrs[attr] = new Observable(value)
    }

    if (children && children.length > 0)
      attrs['children'] = children
  }

  return el
}

/**
 * Inserts an arbitrarily nested list of elements as a child of `parent`,
 * populating `inserted` at the same time with all the inserted elements.
 *
 * Not intended for direct use.
 */
export function addElement(elt: NestedNode, insertionPoint: Node, inserted: Node[]) {
  if (!elt)
    return

  if (typeof elt === 'function')
    return elt.length > 0
      // Element is a function, and we require that it has the signature
      // (insertionPoint: Node, inserted: Node[]) => any
      ? (elt as any)(insertionPoint, inserted)

      // Element is a function but does not take arguments, therefore
      // it cannot insert anything into the DOM via 'parent', and
      // we can assume it returns a DOM element.
      : addElement((elt as any)(), insertionPoint, inserted)

  if (Array.isArray(elt))
    return elt.forEach(el => addElement(el, insertionPoint, inserted))

  elt = elt instanceof Node ? elt : new Text(elt as any)

  if (inserted == null)
    // No 'inserted' array, so the signature is '(elt, parent) => void'
    // Therefore we insert under 'insertionPoint' aka 'parent'
    return insertionPoint.appendChild(elt)

  const parent = insertionPoint.parentElement

  if (parent == null)
    // No parent, so we're pre-initializing
    return inserted.push(elt)

  inserted.push(elt)
  parent.insertBefore(elt, insertionPoint)
}

/**
 * Creates an insertion point,
 * which is an invisible DOM node before which other elements can be inserted.
 *
 * Not intended for direct use.
 */
export function createInsertionPoint(): Node {
  return document.createTextNode('')
}

/**
 * Destroys the given element, unsubscribing to all of its `subscriptions`.
 *
 * Not intended for direct use.
 */
export function destroy(this: JSX.Element) {
  let node: JSX.Element = this || arguments[0]

  node.remove()

  if (node.subscriptions == null)
    return

  node.subscriptions.splice(0).forEach(sub => {
    if ('unsubscribe' in sub)
      sub.unsubscribe()
    else if ('destroy' in sub)
      // @ts-ignore
      sub.destroy()
  })

  if (node.ondestroy != null)
    node.ondestroy()
}


/**
 * Returns whether the given value is an `Observable` stream.
 */
export function isObservable<T>(value: ObservableLike<T>): value is Observable<T> {
  // @ts-ignore
  return value != null && typeof value.subscribe == 'function'
}

/**
 * Returns an `Observable` stream that wraps the given value.
 *
 * If the given value is already an `Observable` stream, it is returned.
 */
export function observable<T>(value: ObservableLike<T>): Obs<T> {
  // @ts-ignore
  return isObservable(value) ? value : new Observable<T>(value)
}

/**
 * Returns the underlying value of the given observable.
 *
 * If the given observable is, in fact, not an observable, it is directly returned.
 */
export function value<T>(value: ObservableLike<T>): T extends Observable<infer V> ? V : T {
  // @ts-ignore
  return isObservable(value) ? value.value : value
}

/**
 * Returns a computed value that is updated every time of one of the given
 * dependencies changes.
 */
export function computed<T>(dependencies: Observable<any>[], computation: () => T): Observable<T> {
  const obs = new Observable<T>(computation())

  if (dependencies.length > 0)
    merge(...dependencies).subscribe(() => obs.value = computation())

  return obs
}

/**
 * Merges multiple observable sequences together.
 */
export function merge(...observables: Rx.Subscribable<any>[]): Rx.Subscribable<any> {
  if (observables.length == 1)
    return observables[0]

  const observers: Rx.PartialObserver<any>[] = []
  const subscriptions: Rx.Unsubscribable[] = []

  for (let i = 0; i < observables.length; i++) {
    subscriptions.push(observables[i].subscribe(v => {
      for (const observer of observers)
        observer.next(v)
    }))
  }

  return {
    subscribe: (
      next    ?: Rx.PartialObserver<any> | ((value: any) => void),
      error   ?: (error: any) => void,
      complete?: () => void
    ): Rx.Unsubscribable => {
      const observer = typeof next == 'function' ? { next, error, complete } : next

      observers.push(observer)

      return {
        unsubscribe: () => {
          observers.splice(observers.indexOf(observer), 1)
        }
      }
    }
  }
}

export { insertChildren } from './map'


// Define various elements to help TypeScript resolve types.
declare global {
  // See https://www.typescriptlang.org/docs/handbook/jsx.html
  namespace JSX {
    type Element = HTMLElement & {
      readonly subscriptions?: Rx.Unsubscribable[]

      ondestroy?: () => void
      destroy(): void
    }

    type AdditionalIntrinsicElementAttributes<K extends keyof HTMLElementTagNameMap> = {
      style?: string | Partial<CSSStyleDeclaration>
      class?: string
      slot ?: string
      ref  ?: HTMLElementTagNameMap[K]
    }

    type IntrinsicElements = {
      // Known elements
      [key in keyof HTMLElementTagNameMap]: Partial<HTMLElementTagNameMap[key]> &
                                            AdditionalIntrinsicElementAttributes<key>
    } & {
      // Unknown elements
      [key: string]: Partial<HTMLElement> & AdditionalIntrinsicElementAttributes<'aside'>
    }
  }
}
