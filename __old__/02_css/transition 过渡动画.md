
## transition 支持情况：ie10+

## js 操作

### 一般操作步骤

先加 transition，再设置目的地

兼容性：ie10+

```js
eBox.style.transition = '0.3s ease'
eBox.style.transform = 'translateX(100px)'

```

### 非 number 属性起始情况

起始值非 number 的属性，需先设置其实值，还需借助 setTimeout

兼容性：ie10+。ie setTimeout 不能设为 0，包括 edge

```js
eBox.style.left = '0' // 默认 auto
eBox.style.transition = '0.3s ease'
setTimeout(function () {
  eBox.style.left = '100px'
}, 1)
```

### 动态增加 elem 情况
先加 elem 到页面，再借助 setTimeout

兼容性：ie10+。ie setTimeout 不能设为 0，包括 edge

```js
let eBox = document.createElement('div')
eBox.className = 'a-box'
this.$el.appendChild(eBox)
setTimeout(function () {
  eBox.style.transition = '0.3s ease'
  eBox.style.transform = 'translateX(100px)'
}, 1)
```

### 虽然 ie setTimeout 不能设为 0，但还是异步

发现 ie setTimeout 为0 可能不会触发动画，以为是同步的，但依然是异步

```js
console.log(1)
setTimeout(function () {
  console.log(2)
}, 0)
console.log(3)

// 1
// 3
// 2
```

### 不用考虑起始值的属性

* opacity
* transform

### 删除 transition 后是否会触发 transitionend 事件？
即动画过程中删除。删除后**不会**触发 transitionend 事件

#### 兼容性
firefox 无法通过删除 transition 终止动画，所以固定会触发 transitionend。  
chrome、edge 没问题。

#### 测试代码

```html
<template>
  <div>
    hello
  </div>
</template>
<script>
export default {
  async mounted () {
    let el = this.$el
    let { transitionActive, to } = this.$style
    let { classList } = el
    classList.add(transitionActive)
    el.addEventListener('transitionend', function () {
      console.log('end')
    })

    await this.wait(1)
    classList.add(to)

    await this.wait(100) // 动画 100ms 后删除
    classList.remove(transitionActive)
  },
  methods: {
    wait (time = 0) {
      return new Promise(resolve => {
        setTimeout(resolve, time)
      })
    }
  }
}
</script>

<style module>
.transitionActive {
  transition: 0.3s ease;
  transition-property: opacity, transform;
}
.to {
  transform: translateX(50%);
}
</style>

```

### 删除 transition 后，之前注册的 transitionend 是否还有效

肯定得有效，也符合正常逻辑
