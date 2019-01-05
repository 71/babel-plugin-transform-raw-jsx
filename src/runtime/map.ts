import { Obs, Observable, ObservableLike, isObservable, observable } from '.'


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
    public elt  : HTMLElement
  ) {}
}


/**
 * Given a parent element, a source list, and a way to render each element
 * of the list, sets up a reactive component that only re-renders children
 * when needed, and wraps each list call into an efficient render-update method.
 */
export function map<T>(
  parent        : HTMLElement,
  list          : ObservableLike<T[]>,
  computeElement: (value: Obs<T>, index: Observable<number>) => HTMLElement
) {
  const values: Obs<T>[] = []
  const reactiveItems: ReactiveItem<T>[] = []

  const vals = isObservable(list) ? list.value : list

  if (vals) {
    for (let i = 0; i < vals.length; i++) {
      const obs = observable(vals[i])
      const index = new Observable(i)
      const element = computeElement(obs, index)

      values.push(obs)
      reactiveItems.push(new ReactiveItem(obs, index, element))

      parent.appendChild(element)
    }
  }

  const nextDivMarker = parent.appendChild(document.createElement('div'))

  nextDivMarker.style.setProperty('display', 'none', 'important')

  function splice(
    reactiveItems: ReactiveItem<T>[],
    values       : Obs<T>[],
    start        : number,
    deleteCount  : number,
    ...items     : Obs<T>[]
  ): Obs<T>[] {
    const reactiveToInsert: ReactiveItem<T>[] = []
    const nextSibling = start >= items.length ? nextDivMarker : reactiveItems[start].elt

    for (let i = 0; i < items.length; i++) {
      let item = items[i]

      if (!isObservable(item))
        // @ts-ignore
        item = items[i] = new Observable(item)

      const index = new Observable(start++)
      const element = computeElement(item, index)

      reactiveToInsert.push(new ReactiveItem(item, index, element))

      nextSibling.parentElement.insertBefore(element, nextSibling)
    }

    for (const { elt } of reactiveItems.splice(start, deleteCount, ...reactiveToInsert))
      elt.remove()

    return values.splice(start, deleteCount, ...items)
  }

  const traps = <ArrayProxy<Obs<T>, ReactiveItem<T>[]>>{
    splice(start: number, deleteCount: number, ...items: Obs<T>[]): Obs<T>[] {
      return splice(this, values, start, deleteCount, ...items)
    },

    pop(): Obs<T> {
      this.pop().elt.remove()

      return values.pop()
    },
    shift(): Obs<T> {
      this.shift().elt.remove()

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

      for (let i = 0; i < len; i++) {
        const a = this[i],
              b = this[this.length - 1 - i]

        // Swap elements
        const afterB = b.elt.nextElementSibling
        const parent = a.elt.parentElement

        a.elt.replaceWith(b.elt)
        parent.insertBefore(a.elt, afterB)

        // Swap in source arrays
        this[i] = b
        this[this.length - 1 - i] = a

        values[i] = b.value
        values[this.length - 1 - i] = a.value

        // Update indices
        a.index.value = this.length - 1 - i
        b.index.value = i
      }

      return values
    },

    sort(compareFn?: (a: Obs<T>, b: Obs<T>) => number): Obs<T>[] {
      // The default implementation is likely faster than something I can
      // come up quickly, so we use it, and then substitue values
      if (this.length == 0)
        return

      // @ts-ignore
      this.sort(compareFn != null ? (a, b) => compareFn(a.value.value, b.value.value) : undefined)

      const parent = this[0].elt.parentElement

      for (let i = 0; i < this.length; i++) {
        // Update reactive item
        const item = this[i]

        item.index.value = i

        // Push element to end of children
        // Since every element is pushed to end in order,
        // this will put them all in their place
        parent.insertBefore(item.elt, nextDivMarker)

        // Update item
        values[i] = item.value
      }
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
      throw new Error('Cannot copy withing a reactive list.')
    }
  }

  const proxy = new Proxy(values, {
    get: (values, p) => {
      if (typeof p == 'number') {
        return values[p]
      }

      if (typeof p == 'string') {
        const trap = traps[p] as Function

        if (typeof trap == 'function')
          return trap.bind(reactiveItems)
      }

      return values[p]
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
      proxy.splice(0, proxy.length, x as any)
    })
  }
}
