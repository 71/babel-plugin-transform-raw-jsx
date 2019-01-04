const Todo = ({ text, done, click = () => null }: { text: string, done: boolean, click?: EventListener }) => (
  <li>
    <p>{text}</p>
    <input type='checkbox' checked={done}
           onclick={click}
           oninput={e => done = (e.target as HTMLInputElement).checked} />
  </li>
)

const TodoApp = ({ pageTitle, todos = [], text = '' }: { pageTitle: string, todos?: any[], text?: string }) => {
  let textBox: HTMLInputElement

  return (
    <div>
      <h1>{pageTitle}</h1>

      <input type='text' value={text} ref={textBox}
             oninput={() => text = textBox.value} />

      { text != '' &&
        <button onclick={() => (todos = todos.concat({ text, done: false })) && (text = '')} />
      }

      <ul class={pageTitle == 'Home' ? 'home-list' : ''}>
        <li>What am I doing here?</li>

        { todos.map(({ text, done }) => (
          <Todo text={text} done={done} />
        )) }

        <li>What am I doing here again?</li>
      </ul>
    </div>
  )
}

// @ts-ignore
const pageTitle = new window.runtime.Observable('Hello world')

document.body.appendChild(<TodoApp pageTitle={pageTitle} />)

setInterval(() => {
  pageTitle.value = 'Current time: ' + new Date().toLocaleTimeString()
}, 1000)
