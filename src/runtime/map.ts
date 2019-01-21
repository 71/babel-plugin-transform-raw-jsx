import { Obs, Observable, ObservableLike, isObservable, observable, createInsertionPoint, value, destroy, NestedNode } from './index'


type ArrayProxy<T, ThisType extends any[] = T[]> = {
  // Takes every function in 'T[]' and adds the 'this: T[]' argument to it
  [P in keyof Array<T>]?: Array<T>[P] extends (...args: infer Args) => infer R
                            ? (this: ThisType, ...args: Args) => R
                            : Array<T>[P]
}

class ReactiveItem<T> {
  constructor(
    public value: Obs<T>,
    public index: Observable<number>,
    public elts : Node[],
    public insertionPoint: Node
  ) {}

  destroy() {
    this.elts.forEach(destroy)
    this.insertionPoint.parentElement.removeChild(this.insertionPoint)
  }
}

function flatten(nestedNode: NestedNode) {
  const arr: Node[] = [];

  (function aux(nestedNode: NestedNode, arr: Node[]) {
    if (nestedNode == null)
      return

    if (typeof nestedNode === 'function')
      return aux((nestedNode as any)(), arr)

    if (Array.isArray(nestedNode))
      return nestedNode.forEach(el => aux(el, arr))

    arr.push(nestedNode instanceof Node ? nestedNode : new Text(nestedNode as any))
  })(nestedNode, arr);

  return arr
}


export function insertChildren(
  parent: HTMLElement,
  list  : Observable<NestedNode[]>
) {
  map(parent, list, value as any)
}

/**
 * Given a parent element, a source list, and a way to render each element
 * of the list, sets up a reactive component that only re-renders children
 * when needed, and wraps each list call into an efficient render-update method.
 */
export function map<T>(
  parent: HTMLElement,
  list  : ObservableLike<T[]>,
  computeElements: (value: Obs<T>, index: Observable<number>) => NestedNode
) {
  let totalLength = 0

  const values: Obs<T>[] = []
  const reactiveItems: ReactiveItem<T>[] = []

  const vals = isObservable(list) ? list.value : list
  const insertionPoint = createInsertionPoint()

  if (vals) {
    for (let i = 0; i < vals.length; i++) {
      const obs = observable(vals[i])
      const index = new Observable(i)
      const elements = flatten(computeElements(obs, index))

      const localInsertionPoint = createInsertionPoint()

      parent.appendChild(localInsertionPoint)

      values.push(obs)
      reactiveItems.push(new ReactiveItem(obs, index, elements, localInsertionPoint))

      elements.forEach(parent.appendChild.bind(parent))
      totalLength += elements.length
    }
  }

  parent.append(insertionPoint)


  function splice(
    reactiveItems: ReactiveItem<T>[],
    values       : Obs<T>[],
    start        : number,
    deleteCount  : number,
    ...items     : Obs<T>[]
  ): Obs<T>[] {
    // Find next sibling for insertion
    let nextSibling = insertionPoint

    for (let i = start; i < reactiveItems.length; i++) {
      const elts = reactiveItems[i].elts

      if (elts.length == 0)
        continue

      nextSibling = elts[0]
      break
    }

    // Transform each item into a reactive element
    const reactiveToInsert: ReactiveItem<T>[] = []

    for (let i = 0; i < items.length; i++) {
      const insertionPoint = createInsertionPoint()

      parent.insertBefore(insertionPoint, nextSibling)

      let item = items[i]

      if (!isObservable(item))
        // @ts-ignore
        item = items[i] = new Observable(item)

      const index = new Observable(start++)
      const elements = flatten(computeElements(item, index))

      reactiveToInsert.push(new ReactiveItem(item, index, elements, insertionPoint))

      elements.forEach(x => nextSibling.parentElement.insertBefore(x, insertionPoint))
      totalLength += elements.length
    }

    for (const reactiveItem of reactiveItems.splice(start, deleteCount, ...reactiveToInsert)) {
      reactiveItem.destroy()
      totalLength -= reactiveItem.elts.length
    }

    return values.splice(start, deleteCount, ...items)
  }

  const traps = <ArrayProxy<Obs<T>, ReactiveItem<T>[]>>{
    splice(start: number, deleteCount: number, ...items: Obs<T>[]): Obs<T>[] {
      return splice(this, values, start, deleteCount, ...items)
    },

    pop(): Obs<T> | undefined {
      if (this.length == 0)
        return

      this.pop().destroy()

      return values.pop()
    },
    shift(): Obs<T> | undefined {
      if (this.length == 0)
        return

      this.shift().destroy()

      return values.shift()
    },

    push(...items: Obs<T>[]): number {
      splice(this, values, values.length, 0, ...items)

      return this.length
    },
    unshift(...items: Obs<T>[]): number {
      splice(this, values, 0, 0, ...items)

      return this.length
    },

    reverse(): Obs<T>[] {
      const len = this.length / 2
      const nextNode = insertionPoint.nextSibling

      for (let i = 0; i < len; i++) {
        const a = this[i],
              b = this[this.length - 1 - i]

        // Swap elements
        const afterA = a.insertionPoint
        const afterB = b.insertionPoint
        const parent = insertionPoint.parentElement

        a.elts.forEach(x => parent.insertBefore(x, afterB))
        b.elts.forEach(x => parent.insertBefore(x, afterA))

        // Swap insertion points
        a.insertionPoint = afterB
        b.insertionPoint = afterA

        // Swap in source arrays
        this[i] = b
        this[this.length - 1 - i] = a

        values[i] = b.value
        values[this.length - 1 - i] = a.value

        // Update indices
        a.index.value = this.length - 1 - i
        b.index.value = i
      }

      if (nextNode != insertionPoint)
        parent.insertBefore(insertionPoint, nextNode)

      return values
    },

    sort(compareFn?: (a: Obs<T>, b: Obs<T>) => number): Obs<T>[] {
      // The default implementation is likely faster than something I can
      // come up quickly, so we use it, and then substitue values
      if (this.length == 0)
        return []

      // @ts-ignore
      this.sort(compareFn != null ? (a, b) => compareFn(a.value.value, b.value.value) : undefined)

      const parent = insertionPoint.parentElement

      for (let i = 0; i < this.length; i++) {
        // Update reactive item
        const item = this[i]

        item.index.value = i

        // Push element to end of children
        // Since every element is pushed to end in order,
        // this will put them all in their place
        item.elts.forEach(x => parent.insertBefore(x, insertionPoint))
        parent.insertBefore(item.insertionPoint, insertionPoint)

        // Update item
        values[i] = item.value
      }

      return values
    },

    fill(value: T | Obs<T>, start?: number, end?: number): Obs<T>[] {
      if (start == null)
        start = 0
      if (end == null)
        end = this.length

      if (isObservable(value))
        value = value.value as T

      for (let i = start; i < end; i++)
        this[i].value.value = value

      return values
    },

    copyWithin(target: number, start: number, end?: number): Obs<T>[] {
      throw new Error('Cannot copy within a reactive list.')
    }
  }

  const proxy = new Proxy(values, {
    get: (values, p) => {
      if (typeof p == 'number') {
        return values[p]
      }

      if (typeof p == 'string') {
        const trap = traps[p as any] as Function

        if (typeof trap == 'function')
          return trap.bind(reactiveItems)
      }

      return values[p as any]
    },

    set: (values, p, value) => {
      if (typeof p != 'number')
        return false

      if (isObservable(value))
        values[p].value = value.value
      else
        values[p].value = value

      return true
    }
  })


  if (isObservable(list)) {
    // @ts-ignore
    list.setUnderlyingValue(proxy)

    list.subscribe(x => {
      // Maybe we could try doing a diff between the two lists and update
      // accordingly, but right now we don't.
      proxy.splice(0, proxy.length, ...x as Obs<T>[])
    })
  }
}
