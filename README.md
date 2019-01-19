babel-plugin-transform-raw-jsx
==============================

A [Babel](https://babeljs.io) plugin that transforms
[JSX elements](https://reactjs.org/docs/introducing-jsx.html)
into raw DOM API calls.

This plugin can optionally include a (small, under 2KB) runtime, which takes
care of updating elements when needed.


## Getting started

#### Add to dependencies

```
yarn add --dev babel-plugin-transform-raw-jsx
```

Sorry, I haven't taken the time to upload it on NPM just yet. If you want me to,
just submit an issue and I'll publish it ASAP.

#### Configure in `.babelrc.js`

```js
module.exports = {
  plugins: [
    // Note that we need the React transform plugin to run
    // before doing anything:
    ["@babel/plugin-transform-react-jsx"],

    ["plugin-transform-raw-jsx", {
      // Default options:

      // Pragma used by React.
      pragma    : "React.createElement",

      // How to prepend all imports; pass `null` if they already
      // are in the global scope.
      importName: "require('babel-plugin-transform-raw-jsx/runtime')",

      // Whether the runtime should be disabled.
      noRuntime : false,

      // Whether extras features of the runtime should be enabled.
      runtimeExtras: false
    }]
  ]
}
```


## Using without the runtime

If you don't need the reactive properties and auto-updates and
simply want to generate some elements without using `document.createElement`,
`element.setAttribute` and `element.appendChild`, then this plugin can also
be used without the runtime.

```jsx
const div: HTMLDivElement = <div>Hello world!</div>

const Link = ({ to }) => (<a href={to} class='fancy-link' />)

const ListOfLinks = ({ listTitle = 'Hello world', links }) => (
  <div>
    <h1>{listTitle}</h1>
    <ul>
    { links.map(({ to, text }) => <Link to={to}>{text}</Link>) }
    </ul>
  </div>
)

const links = [
  { to: 'https://babeljs.io', text: 'Babel' }
]

document.body.appendChild(<ListOfLinks links={links} />)
```

Something close to the following code will be generated.

```js
const div = document.createElement('div')

const Link = ({ to }) => {
  const a = document.createElement('a')
  const attributes = { href: to, class: 'fancy-link' }

  for (const attrKey in attributes)
    a[attrKey] = attributes[attrKey]

  return a
}

const ListOfLinks = ({ listTitle = 'Hello world', links }) => {
  const div = document.createElement('div')

  const h1 = document.createElement('h1')

  // 'addElement' takes care of inserting elements, even if
  // the given element is a list, a list of list, ...
  addElement(listTitle, h1)

  div.appendChild(h1)

  const ul = document.createElement('ul')

  addElement(links.map(({ to, text }) => {
    const link = Link({ to: to })

    addElement(text, link)

    return link
  }), ul)

  div.appendChild(ul)

  return div
}

const links = [
  { to: 'https://babeljs.io', text: 'Babel' }
]

const listOfLinks = ListOfLinks({ links: links })

document.body.appendChild(listOfLinks)
```


## Using with the runtime

At compile time, all local variables are transformed to reactive values, and
the variables on which all attributes and elements depend on are resolved.

Using this information, the runtime can set up events that will automatically
refresh parts of the DOM when a value it depends on changes.

For instance, here is what a todo list might look like:

```jsx
interface TodoState {
  text  : string
  done  : boolean
  click?: EventListener
}

const Todo = ({ text, done, click = () => null }: TodoState) => (
  <li>
    <p>{text}</p>
    <input type='checkbox' checked={done}
           onclick={click}
           oninput={e => done = e.target.checked} />
  </li>
)

interface AppState {
  pageTitle: string
  todos   ?: any[]
  text    ?: string
}

const TodoApp = ({ pageTitle, todos = [], text = '' }: AppState) => {
  // 'textBox' will have its value set later, as soon as the <input>
  // element is created
  let textBox: HTMLInputElement

  return (
    <div>
      <h1>{pageTitle}</h1>

      <input type='text' value={text} ref={textBox}
             oninput={() => text = textBox.value} />

      { text != '' &&
        <button onclick={() => (todos = todos.concat({ text, done: false }))
                            && (text  = '')} />
      }

      <ul class={pageTitle == 'Home' ? 'home-list' : ''}>
        {/* Just showing off that the todos can be inserted anywhere... */}
        <li>Foo</li>

        { todos.map(({ text, done }) => (
          <Todo text={text} done={done} />
        )) }

        {/* Ditto. */}
        <li>What am I doing here again?</li>
      </ul>
    </div>
  )
}

document.body.appendChild(<TodoApp pageTitle='Hello world' />)
```

The generated code will look like this:

```js
import {
  addElement,
  createElement,
  computed,
  Observable
} from 'babel-plugin-transform-raw-jsx/runtime'

interface TodoState {
  text  : string
  done  : boolean
  click?: EventListener
}

const Todo = ({ text, done, click = () => null }: TodoState) => {
  const text  = isObservable(text)  ? text  : new Observable(text),
        done  = isObservable(done)  ? done  : new Observable(done),
        click = isObservable(click) ? click : new Observable(click)

  // <li>
  const li = createElement('li', null)

  //   <p>
  const p = createElement('p', null)

  li.appendChild(p)

  //     {text}
  const inserted = []
  const nextMarker = p.appendChild(document.createElement('div'))

  nextMarker.style.display = 'none'

  const handler = () => {
    // We don't want to keep the previous elements, so we remove them
    inserted.splice(0, inserted.length).forEach(p.removeChild.bind(p))

    // This will insert all elements in 'text.value' before 'nextMarker'
    addElement(p, text.value, inserted, nextMarker)
  }

  // 'handler' will be called everytime 'text' changes
  text.subscribe(handler)

  // Call it once manually first to initialize it, though
  handler()

  //   </p>


  //   <input type='checkbox' checked={done}
  //          onclick={click}
  //          oninput={e => done = e.target.checked} />
  const input = createElement('input', {
    type   : 'checkbox',
    checked: done,
    onclick: click,

    // Assigning to 'done.value' here allows us to notify listeners
    // of a value change.
    oninput: e => done.value = e.target.checked
  })

  li.appendChild(input)

  // </li>

  return li
}

// ... snip ...

const todoApp = createElement(TodoApp, {
  pageTitle: 'Hello world'
})

document.body.appendChild(todoApp)
```

Note that if we had wanted to change the page title later on, we
could have done the following:

```js
const pageTitle = new Observable('Hello world')
const todoApp = createElement(TodoApp, {
  pageTitle
})

document.body.appendChild(todoApp)

setInterval(() => {
  pageTitle.value = 'Current time: ' + new Date().toLocaleTimeString()
}, 1000)
```


### Runtime extras: Efficient lists

The generated code for this part of the `TodoApp` component:

```jsx
{ todos.map(({ text, done }) => (
  <Todo text={text} done={done} />
)) }
```

Would look like this:

```js
const insertedTodos = []
const nextMarker    = ul.appendChild(document.createElement('div'))

nextMarker.style.display = 'none'

const handler = () => {
  insertedTodos.splice(0, insertedTodos.length).forEach(ul.removeChild.bind(ul))

  addElement(ul, todos.value.map(({ text, done }) => {
    const text = isObservable(text) ? text : new Observable(text),
          done = isObservable(text) ? done : new Observable(done)

    return createElement(Todo, { text, done })
  }), insertedTodos, nextMarker)
}

todos.subscribe(handler)

handler()
```

As you may have noticed, this causes `handler` to be called every time `todos` changes,
which means that the entire list will be removed, and then re-rendered.

In order to avoid going through this, an optional `map` module is provided,
which provides the function `map` that takes care of this problem.

Therefore, the previous invocation becomes:

```jsx
import { map } from 'babel-plugin-transform-raw-jsx/runtime/map'

{ parent => map(parent, todos, ({ text, done }) => (
  <Todo text={text} done={done} />
)) }
```

Now, all calls to `todos.push`, `todos.splice`, `todos.sort`, etc will be intercepted,
and the DOM will be modified directly instead of having to redraw everything.


### Runtime extras: Async components

Four different ways are provided to deal with async components:
1. A function that wraps a `Promise<Component>` into a simple `Component`.
2. A function that wraps a `(props) => Promise<Element>` into a simple `Component`.
3. A component that renders an asynchronous component.
4. A component that renders a synchronous component, after having resolved its properties
   asynchronously.

If you have an editor with TypeScript support nearby, you can play with
[the `async` example](./examples/async/index.tsx) and see that the type checker
will always make sure all the needed properties are passed, even with wrappers like
async components.


### Other features

#### Slots

Slots can be added to components if you wish to modify their content.

```jsx
const Foo = () => (
  <div>
    <slot>
      This is the content of the default slot. If some code
      is given (as we'll see), this element will be overriden by
      the given content.
      <b>Slots can have as many elements as you want.</b>
    </slot>

    {/* Slots can also be named and/or have no default content. */}
    <slot name='after' />

    <b>Any other content can be here.</b>
  </div>
)

<Foo>
  <i>
    This text will replace the text in the unnamed slot component above.
  </i>

  <a slot='after'>
    This will obviously be inserted after that whole text.
  </a>

  <h4>
    And if many elements are given for the same slot, they'll be inserted
    one after the other.
  </h4>
</Foo>
```


### Component lifecycle

This may seem obvious, considering the example generated code shown above, but while making
components, the following information should be kept in mind, since rendering with this
plugin is very different from regular rendering.

- Components are rendered **once**.
- When a value changes, all the properties that depend on it will automatically be updated.
- Optionally rendering large components will trigger complete DOM redraws, which can be expensive.
  It should therefore be avoided.


## Roadmap
- [X] Add ability to access an observable from within a component, instead of taking its value.
- [X] Provide a way to remove elements and their attached event handlers.
  - [ ] Actually track resources in order to make `element.destroy()` more useful.
- [ ] Add more tests.
- [X] Publish the plugin on NPM.
