import * as Rx from 'rxjs'

/**
 * Defines an observable stream that notifies subscribers of a change of a value.
 */
export class Observable<T> implements Rx.Subscribable<T> {
  private val: T
  private readonly observers: Rx.PartialObserver<T>[]
  private readonly deepObserve: boolean

  constructor(value: T, deep: boolean = true) {
    this.observers = []
    this.deepObserve = deep

    this.setUnderlyingValue(value)
  }

  /**
   * Sets the underlying value without notifying subscribers of the change.
   */
  setUnderlyingValue(value: T) {
    // if (this.deepObserve) {
    //   if (Array.isArray(value)) {
    //     // Replace array by watched array
    //     // TODO
    //   }

    //   else if (typeof value == 'object') {
    //     // Replace object by watched object
    //     // TODO
    //   }
    // }

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

    for (const observer of this.observers)
      observer.next(value)
  }

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
}


/**
 * Creates an {HTMLElement}, given its parent, tag, and attributes.
 * 
 * @param parent The parent of the node to create, to which the node
 *   will be appended. Can be `null`.
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
 * Creates an {HTMLElement}, given its parent, component, and attributes.
 * 
 * @param parent The parent of the node to create, to which the node
 *   will be appended. Can be `null`.
 * @param tag The component of the element to create.
 * @param attrs An optional object that contains attributes and properties that
 *   will be set on the created element.
 * 
 * @returns The corresponding HTML element.
 */
export function createElement<K extends (props: object) => Element>(
  component: K,
  attrs    : K extends (props: infer A) => infer E ? A & Partial<E> : never,
): ReturnType<K>

export function createElement(
  tag   : string | ((props: object) => Element),
  attrs : object
): Element {
  attrs = attrs || {}

  const isElement = typeof tag == 'string'
  const el = isElement
    ? document.createElement(tag as any)
    : (tag as any)(attrs)

  for (let attr in attrs) {
    let value = attrs[attr]

    if (value == null)
      continue

    let isObs = isObservable(value)

    if (!isElement) {
      value = attrs[attr] = new Observable(value)
      isObs = true
    }

    el[attr] = isObs ? value.value : value

    if (isObs)
      value.subscribe(() => el[attr] = value.value)
  }

  return el
}

/**
 * Inserts an arbitrarily nested list of elements as a child of `parent`,
 * populating `inserted` at the same time with all the inserted elements.
 */
export function addElement(parent: HTMLElement, elt: any, inserted: HTMLElement[], nextDivMarker: HTMLElement) {
  if (!elt)
    return

  if (Array.isArray(elt)) {
    for (const child of elt)
      addElement(parent, child, inserted, nextDivMarker)
    return
  }

  if (inserted == null)
    return parent.appendChild(elt)

  if (typeof elt == 'string')
    elt = new Text(elt)

  inserted.push(elt)
  parent.insertBefore(elt, nextDivMarker)
}

/**
 * Renders the given component to an HTML element.
 */
export function render(element: JSX.Element): HTMLElement {
  return element
}


/**
 * Returns whether the given value is an `Observable` stream.
 */
export function isObservable(value: any): value is Observable<any> {
  return typeof value.subscribe == 'function'
}

/**
 * Returns an `Observable` stream that wraps the given value.
 * 
 * If the given value is already an `Observable` stream, it is returned.
 */
export function observable<T>(value: T): T extends Observable<T> ? T : Observable<T> {
  if (isObservable(value))
    return value as any
  else
    return new Observable<T>(value) as any
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

  for (const observable of observables) {
    subscriptions.push(observable.subscribe(v => {
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


// Define various elements to help TypeScript resolve types.
declare global {
  // See https://www.typescriptlang.org/docs/handbook/jsx.html
  namespace JSX {
    type Element = HTMLElement

    type IntrinsicElements = {
      [key in keyof HTMLElementTagNameMap]: Partial<HTMLElementTagNameMap[key]> & {
        class?: string
        ref  ?: HTMLElementTagNameMap[key]
      }
    }
  }
}
