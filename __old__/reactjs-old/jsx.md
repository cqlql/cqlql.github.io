
循环

```jsx
var MyComponent = Vue.extend({
  data () {
    return {
      list: ['1', '2']
    }
  },
  methods: {
    testfn () {
      console.log(this)
    }
  },
  render () {
    let ls = [<li>{this.name}</li>]
    this.list.forEach(v => {
      ls.push(<li>{v}</li>)
    })
    return (
      <div className="top-list-select">
        <ul className="l-mu">
          {ls}
        </ul>

      </div>
    )
  }
})

```