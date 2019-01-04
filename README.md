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

#### Configure in `.babelrc.js`
```javascript
module.exports = {
  plugins: [
    // Note that we need the React transform plugin to run
    // before doing anything:
    ["@babel/plugin-transform-react-jsx"],

    ["plugin-transform-raw-jsx", {
      // Default options:
      pragma    : "React.createElement",
      noRuntime : false,
      importName: "require('plugin-transform-raw-jsx/runtime')"
    }]
  ]
}
```


## Using without the runtime

If you don't need the reactive properties and auto-updates and
simply want to generate some elements without using `document.createElement`,
`element.setAttribute` and `element.appendChild`, then this plugin can also
be used without the runtime.

```javascript
const div: HTMLDivElement = <div>Hello world!</div>

const Link = ({ to }) => (<a href={to} class='fancy-link' />)

const ListOfLinks = ({ listTitle = 'Hello world', links }) => (<div>
  <h1>{listTitle}</h1>
  <ul>
  { links.map(({ to, text }) => <Link to={to}>{text}</Link>) }
  </ul>
</div>)

const links = [
  { to: 'https://babeljs.io', text: 'Babel' }
]

document.body.appendChild(<ListOfLinks links={links} />)
```

Something close to the following code will be generated.

```javascript
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

```javascript
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

```javascript
import {
  addElement,
  createElement,
  computed,
  Observable
} from 'babel-plugin-transform-raw-jsx/runtime'

interface TodoState {
  text: string
  done: boolean
  click?: EventListener
}

const Todo = ({ text, done, click = () => null }: TodoState) => {
  const text  = isObservable(text)  ? text  : new Observable(text),
        done  = isObservable(done)  ? done  : new Observable(done),
        click = isObservable(click) ? click : new Observable(click)

  // <li>
  const li = createElement("li", null)

  //   <p>
  const p = createElement("p", null)

  li.appendChild(p)

  //     {text}
  const inserted = []
  const nextMarker = p.appendChild(document.createElement("div"))

  nextMarker.style.display = "none"

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
  const input = createElement("input", {
    type   : "checkbox",
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

```javascript
const pageTitle = new Observable('Hello world')
const todoApp = createElement(TodoApp, {
  pageTitle
})

document.body.appendChild(todoApp)

setInterval(() => {
  pageTitle.value = 'Current time: ' + new Date().toLocaleTimeString()
}, 1000)
```
