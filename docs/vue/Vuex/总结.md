- [说明](#说明)
- [Store - Vuex 的开始](#store---vuex-的开始)
- [State - 相当于组件的 data](#state---相当于组件的-data)
  - [辅助函数 mapState](#辅助函数-mapstate)
  - [mapState 参数是对象](#mapstate-参数是对象)
  - [mapState 参数是数组。属性名与子节点名相同时使用](#mapstate-参数是数组属性名与子节点名相同时使用)
  - [多个计算属性情况，对象展开运算符](#多个计算属性情况对象展开运算符)
  - [遵循 Vue 的响应规则](#遵循-vue-的响应规则)
- [Getter - 相当于计算属性](#getter---相当于计算属性)
  - [辅助函数 mapGetters](#辅助函数-mapgetters)
- [Mutation - 修改 state，只支持同步](#mutation---修改-state只支持同步)
  - [简单使用](#简单使用)
  - [载荷提交（Payload）- 传参](#载荷提交payload--传参)
  - [对象提交](#对象提交)
  - [mapMutations 辅助函数](#mapmutations-辅助函数)
- [Action - 扩展 Mutation](#action---扩展-mutation)
  - [基本使用](#基本使用)
  - [辅助函数 mapActions](#辅助函数-mapactions)
  - [组合 Action、相互调用、支持 Promise](#组合-action相互调用支持-promise)
- [Module - 将 store 分割成模块](#module---将-store-分割成模块)
  - [基本使用](#基本使用-1)
  - [getters、mutations 和 actions 的模块方式调用开启；嵌套模块示例](#gettersmutations-和-actions-的模块方式调用开启嵌套模块示例)
  - [反过来，命名空间再注册到全局 action](#反过来命名空间再注册到全局-action)
  - [辅助函数的模块方式调用以及简化](#辅助函数的模块方式调用以及简化)
  - [动态模块](#动态模块)
  - [一个模块注册多次重用处理](#一个模块注册多次重用处理)
- [进阶内容](#进阶内容)
  - [插件](#插件)
  - [严格模式](#严格模式)
  - [表单处理 v-model 问题](#表单处理-v-model-问题)

## 说明

这里只是为了哪天淡忘了能快速理解并上手开发，详细的还是得以[官方文档](https://vuex.vuejs.org/zh/)为准

## Store - Vuex 的开始

根，仓库，容器

```js
import Vue from "vue";
import Vuex from "vuex";

Vue.use(Vuex);

const store = new Vuex.Store({
  state: {
    count: 0,
  },
  mutations: {
    increment(state) {
      state.count++;
    },
  },
});

new Vue({
  el: "#app",
  /*
  题外话：
  store 选项可以不赋值，但一般推荐赋值。否则可能需要使用单例去调用 store

  这是为了可以在组件中通过 this.$store 访问。而且这也是辅助函数的使用前提
   */
  store,
});
```

## State - 相当于组件的 data

### 辅助函数 mapState

### mapState 参数是对象

```js
// 在单独构建的版本中辅助函数为 Vuex.mapState
import { mapState } from "vuex";

export default {
  // ...
  computed: mapState({
    count: (state) => state.count,

    // 传字符串参数 'count' 等同于 `state => state.count`
    countAlias: "count",

    // 为了能够使用 `this` 获取局部状态，必须使用常规函数
    countPlusLocalState(state) {
      return state.count + this.localCount;
    },
  }),
};
```

### mapState 参数是数组。属性名与子节点名相同时使用

```js
computed: mapState([
  // 映射 this.count 为 store.state.count
  "count",
]);
```

### 多个计算属性情况，对象展开运算符

```js
computed: {
  localComputed () { /* ... */ },
  // 使用对象展开运算符将此对象混入到外部对象中
  ...mapState({
    // ...
  })
}
```

### 遵循 Vue 的响应规则

可以使用 `Vue.set(obj, 'newProp', 123)` 添加新属性

## Getter - 相当于计算属性

创建

```js
const store = new Vuex.Store({
  state: {
    todos: [
      { id: 1, text: "...", done: true },
      { id: 2, text: "...", done: false },
    ],
  },
  getters: {
    doneTodos: (state) => {
      return state.todos.filter((todo) => todo.done);
    },
    // getter 作为第二个参数
    doneTodosCount: (state, getters) => {
      return getters.doneTodos.length;
    },
    // 通过方法访问，实现给 getter 传参。但不会缓存结果
    // 使用：store.getters.getTodoById(2)
    getTodoById: (state) => {
      return (id) => {
        return state.todos.find((todo) => todo.id === id);
      };
    },
  },
});
```

组件内访问

```js
computed: {
  doneTodosCount () {
    return this.$store.getters.doneTodosCount
  }
}
```

### 辅助函数 mapGetters

```js
import { mapGetters } from 'vuex'

export default {
  // 映射到组件内的计算属性
  computed: {
    // 使用对象展开运算符将 getter 混入 computed 对象中
    ...mapGetters([
      'doneTodosCount',
      'anotherGetter',
      // ...
    ])
    // 改名，参数时对象
    ...mapGetters({
      // 把 `this.doneCount` 映射为 `this.$store.getters.doneTodosCount`
      doneCount: 'doneTodosCount'
    })
  }
}
```

## Mutation - 修改 state，只支持同步

由于不能直接修改 state，所以只能通过 mutation 触发变化

一般是单个状态的修改

只支持同步，因为异步调用让 devtool 不可追踪

类似 methods，但不能直接调用，需通过 `store.commit` 方法调用，为了 devtool 追踪

### 简单使用

```js
const store = new Vuex.Store({
  state: {
    count: 1,
  },
  mutations: {
    // 声明
    increment(state) {
      // 变更状态
      state.count++;
    },
  },
});

// 提交
store.commit("increment");
```

### 载荷提交（Payload）- 传参

```js
// 只支持一个参数，所以通常是对象，这样就可以包含多个字段

// 声明
mutations: {
  increment (state, n) {
    state.count += n
  }
}

// 提交
store.commit('increment', 10)

```

### 对象提交

```js
// 声明处，参数以对象形式调用
mutations: {
  increment (state, payload) {
    state.count += payload.amount
  }
}
// 提交
store.commit({
  type: 'increment',
  amount: 10
})
```

### mapMutations 辅助函数

```js
import { mapMutations } from "vuex";

export default {
  // ...
  methods: {
    ...mapMutations([
      "increment", // 将 `this.increment()` 映射为 `this.$store.commit('increment')`

      // `mapMutations` 也支持载荷：
      "incrementBy", // 将 `this.incrementBy(amount)` 映射为 `this.$store.commit('incrementBy', amount)`
    ]),
    // 改名
    ...mapMutations({
      add: "increment", // 将 `this.add()` 映射为 `this.$store.commit('increment')`
    }),
  },
};
```

## Action - 扩展 Mutation

实现多个 mutation 逻辑执行；可以异步

官方解释：

> Action 类似于 mutation，不同在于：
>
> - Action 提交的是 mutation，而不是直接变更状态。
> - Action 可以包含任意异步操作。

### 基本使用

```js
const store = new Vuex.Store({
  state: {
    count: 0,
  },
  mutations: {
    increment(state) {
      state.count++;
    },
  },
  actions: {
    increment(context) {
      context.commit("increment");
    },
    incrementAsync({ commit }) {
      setTimeout(() => {
        commit("increment");
      }, 1000);
    },
  },
});

// 通过 store.dispatch 方法触发：
store.dispatch("increment");

// 以载荷形式分发
store.dispatch("incrementAsync", {
  amount: 10,
});

// 以对象形式分发
store.dispatch({
  type: "incrementAsync",
  amount: 10,
});
```

### 辅助函数 mapActions

```js
import { mapActions } from "vuex";

export default {
  // ...
  methods: {
    ...mapActions([
      "increment", // 将 `this.increment()` 映射为 `this.$store.dispatch('increment')`

      // `mapActions` 也支持载荷：
      "incrementBy", // 将 `this.incrementBy(amount)` 映射为 `this.$store.dispatch('incrementBy', amount)`
    ]),
    // 改名
    ...mapActions({
      add: "increment", // 将 `this.add()` 映射为 `this.$store.dispatch('increment')`
    }),
  },
};
```

### 组合 Action、相互调用、支持 Promise

也就是说，除了能组合多个 mutation，还能组合多个 Action 执行

```js
// 假设 getData() 和 getOtherData() 返回的是 Promise

actions: {
  async actionA ({ commit }) {
    commit('gotData', await getData())
  },
  async actionB ({ dispatch, commit }) {
    await dispatch('actionA') // 等待 actionA 完成
    commit('gotOtherData', await getOtherData())
  }
}
```

## Module - 将 store 分割成模块

### 基本使用

```js
const moduleA = {
  state: () => ({ ... }),
  mutations: { ... },
  actions: { ... },
  getters: { ... }
}

const moduleB = {
  state: () => ({ ... }),
  mutations: { ... },
  actions: { ... }
}

// 访问全局内容
const foo = {
  getters: {
    // state, getters 参数被局部化了
    // 第三和第四个参数访问全局 state getters
    someGetter (state, getters, rootState, rootGetters) {
      getters.someOtherGetter // -> 'foo/someOtherGetter'
      rootGetters.someOtherGetter // -> 'someOtherGetter'
    },
    someOtherGetter: state => { ... }
  },
  actions: {
    // 在这个模块中， dispatch 和 commit 也被局部化了
    // 他们可以接受 `root` 属性以访问根 dispatch 或 commit
    someAction ({ dispatch, commit, getters, rootGetters }) {
      getters.someGetter // -> 'foo/someGetter'
      rootGetters.someGetter // -> 'someGetter'

      dispatch('someOtherAction') // -> 'foo/someOtherAction'
      dispatch('someOtherAction', null, { root: true }) // -> 'someOtherAction'

      commit('someMutation') // -> 'foo/someMutation'
      commit('someMutation', null, { root: true }) // -> 'someMutation'
    },
    someOtherAction (ctx, payload) { ... }
  }
}

const store = new Vuex.Store({
  modules: {
    a: moduleA,
    b: moduleB,
    foo
  }
})

// 调用
store.state.a // -> moduleA 的状态
store.state.b // -> moduleB 的状态
// 注意！！模块的 getters mutations actions 依然注册在全局命名空间上的，所以调用的方式依然是非模块方式
// 但可以设置 namespaced: true 使其成为带命名空间的模块。见下
```

### getters、mutations 和 actions 的模块方式调用开启；嵌套模块示例

`namespaced: true` 即可开启

```js
const store = new Vuex.Store({
  modules: {
    account: {
      // 开启 getters、mutations 和 actions 模块方式调用
      namespaced: true,

      // 模块内容（module assets）
      state: () => ({ ... }), // 模块内的状态已经是嵌套的了，使用 `namespaced` 属性不会对其产生影响
      getters: {
        isAdmin () { ... } // -> getters['account/isAdmin']
      },
      actions: {
        login () { ... } // -> dispatch('account/login')
      },
      mutations: {
        login () { ... } // -> commit('account/login')
      },

      // 嵌套模块
      modules: {
        // 继承父模块的命名空间
        myPage: {
          state: () => ({ ... }),
          getters: {
            profile () { ... } // -> getters['account/profile']
          }
        },

        // 进一步嵌套命名空间
        posts: {
          namespaced: true,

          state: () => ({ ... }),
          getters: {
            popular () { ... } // -> getters['account/posts/popular']
          }
        }
      }
    }
  }
})
```

### 反过来，命名空间再注册到全局 action

添加 `root: true` 即可

```js
{
  actions: {
    someOtherAction ({dispatch}) {
      dispatch('someAction')
    }
  },
  modules: {
    foo: {
      namespaced: true,

      actions: {
        // someAction 将注册到全局
        someAction: {
          root: true,
          handler (namespacedContext, payload) { ... } // -> 'someAction'
        }
      }
    }
  }
}
```

### 辅助函数的模块方式调用以及简化

```js
// 未简化前
computed: {
  ...mapState({
    a: state => state.some.nested.module.a,
    b: state => state.some.nested.module.b
  })
},
methods: {
  ...mapActions([
    'some/nested/module/foo', // -> this['some/nested/module/foo']()
    'some/nested/module/bar' // -> this['some/nested/module/bar']()
  ])
}

// 简化后
computed: {
  ...mapState('some/nested/module', {
    a: state => state.a,
    b: state => state.b
  })
},
methods: {
  ...mapActions('some/nested/module', [
    'foo', // -> this.foo()
    'bar' // -> this.bar()
  ])
}

// 更进一步：直接创建某命名空间的辅助函数
import { createNamespacedHelpers } from 'vuex'
const { mapState, mapActions } = createNamespacedHelpers('some/nested/module')
export default {
  computed: {
    // 在 `some/nested/module` 中查找
    ...mapState({
      a: state => state.a,
      b: state => state.b
    })
  },
  methods: {
    // 在 `some/nested/module` 中查找
    ...mapActions([
      'foo',
      'bar'
    ])
  }
}
```

### 动态模块

用时才注册，不用就销毁

```js
import Vuex from "vuex";

const store = new Vuex.Store({
  /* 选项 */
});

// 注册模块 `myModule`
store.registerModule("myModule", {
  namespaced: true, // 注意最好带命名空间，否则 actions 将是全局注册
  state: {
    foo: "foo",
  },
  actions: {
    toFriend(context) {
      console.log(arguments);
    },
  },

  // ...
});
// 注册嵌套模块 `nested/myModule`
store.registerModule(["nested", "myModule"], {
  // ...
});

// 卸载模块 `myModule`。不能卸载静态模块(即创建 store 时声明的模块)
store.unregisterModule("myModule");

// 检查该模块是否注册
store.hasModule("myModule");
```

**保留 state**

如果此模块之前存在，又不想覆盖 state，这时可通过设置 `preserveState: true` 保留 state

```js
store.registerModule("a", module, { preserveState: true });
```

### 一个模块注册多次重用处理

类似组件被引用多次，data 需使用函数一样，state 也支持函数。这样每次注册都是一个新实例了。

```js
const MyReusableModule = {
  state: () => ({
    foo: "bar",
  }),
  //...
};
```

## 进阶内容

### 插件

暴露了每次 mutation 钩子，每次 mutation 之后调用

### 严格模式

保证 state 的修改都通过 mutation，发布环境需禁用

### 表单处理 v-model 问题

```html
<input v-model="obj.message" />
```

这里 `obj` 属于 vuex state，`v-model` 会试图直接修改 `obj.message`，严格模式下会报错。这里可以用 v-bind + v-on 原始实现解决，推荐用 **双向绑定的计算属性** 解决，也保留了 v-model 中很有用的特性。

```js
// ...
computed: {
  message: {
    get () {
      return this.$store.state.obj.message
    },
    set (value) {
      this.$store.commit('updateMessage', value)
    }
  }
}
```
