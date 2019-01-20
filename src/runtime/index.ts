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

type Slot = {
  elements  : Node[]
  nextMarker: Node
  hasDefault: boolean
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
 *
 * Not intended for direct use.
 */
export function addElement(parent: HTMLElement, elt: any, inserted: Node[], nextMarker: Node) {
  if (!elt)
    return

  if (Array.isArray(elt)) {
    for (let i = 0; i < elt.length; i++)
      addElement(parent, elt[i], inserted, nextMarker)
    return
  }

  if (!(elt instanceof Node))
    elt = new Text(elt)

  if (inserted == null)
    return parent.appendChild(elt)

  inserted.push(elt)
  parent.insertBefore(elt, nextMarker)
}

/**
 * Creates a marker node, which is an invisible node before which other elements can be inserted.
 *
 * Not intended for direct use.
 */
export function createMarker(): Node {
  return document.createTextNode('')
}

/**
 * Defines a new slot for an element.
 *
 * Not intended for direct use.
 */
export function defineSlot(element: JSX.Element, slotName: string, def?: any[]) {
  if (def != null) {
    for (let i = 0; i < def.length; i++) {
      if (!(def[i] instanceof Node))
        def[i] = new Text(def[i])

      element.appendChild(def[i])
    }
  }

  const marker = element.appendChild(createMarker())
  const slot: Slot = {
    hasDefault: def != null,
    elements  : def || [],
    nextMarker: marker
  }

  if (element.slots == null)
    // @ts-ignore
    element.slots = { [slotName]: slot }
  else
    element.slots[slotName] = slot
}

/**
 * Destroys the given element, unsubscribing to all of its `subscriptions`.
 *
 * Not intended for direct use.
 */
export function destroy(this: JSX.Element) {
  let node = this || arguments[0]

  node.remove()

  if (node.subscriptions == null)
    return

  node.subscriptions.splice(0).forEach(sub => sub.unsubscribe)

  if (node.ondestroy != null)
    node.ondestroy()
}

/**
 * Appends the given element or group of elements to the
 * given slot.
 *
 * Not intended for direct use.
 */
export function appendToSlot(this: JSX.Element, slot: string, elt: any) {
  if (this.slots == null || !(slot in this.slots))
    throw new Error(`Unknown slot '${slot}' given.`)

  const { elements, nextMarker, hasDefault } = this.slots[slot]

  if (hasDefault) {
    const parent = nextMarker.parentElement
    elements.splice(0).forEach(parent.removeChild.bind(parent))
    Object.assign(this.slots[slot], { hasDefault: false, elements })
  }

  addElement(nextMarker.parentElement, elt, elements, nextMarker)
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


// Define various elements to help TypeScript resolve types.
declare global {
  // See https://www.typescriptlang.org/docs/handbook/jsx.html
  namespace JSX {
    type Element = HTMLElement & {
      ondestroy?: () => void

      readonly destroy     : () => void
      readonly appendToSlot: (slot: string, child: any) => void

      readonly slots?: Record<string, Slot>
      readonly subscriptions?: Rx.Unsubscribable[]
    }

    type IntrinsicElements = {
      [key in keyof HTMLElementTagNameMap]: Partial<HTMLElementTagNameMap[key]> & {
        class?: string
        slot ?: string
        ref  ?: HTMLElementTagNameMap[key]
      }
    }
  }
}
