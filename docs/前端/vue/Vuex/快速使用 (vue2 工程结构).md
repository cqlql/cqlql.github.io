---
title: 快速使用 (vue2 工程结构)
icon: mdi:folder-cog
sort: 2
---

vue2 项目中 Vuex 的典型目录组织与调用方式，可直接套用。API 细节见 [总结](./总结.md)。

## 目录结构

```
src/store/
  index.js        # 组装 modules 与全局 getters
  getters.js      # 全局 getters，扁平化各模块 state
  modules/
    user.js
```

## `@/store/index.js`

```js
import Vue from "vue";
import Vuex from "vuex";
import getters from "./getters";
import user from "./modules/user.js";

Vue.use(Vuex);

const store = new Vuex.Store({
  modules: {
    user,
  },
  getters,
});

export default store;
```

## `@/store/getters.js`

把各模块深层 state 提到顶层，组件里少写一截路径。

```js
const getters = {
  token: (state) => state.user.token,
  avatar: (state) => state.user.userInfo.avatar,
  name: (state) => state.user.userInfo.name,
  userInfo: (state) => state.user.userInfo,
  authList: (state) => state.user.authList,
  // getters 可作为第二个参数复用其它 getter
  isSuperAdmin: (state, getters) => getters.authList.isSuperAdmin,
};
export default getters;
```

## `@/store/modules/user.js`

```js
const state = {
  token: getToken(), // 从 cookies 中初始化
  userInfo: {},
};

const getters = {
  hasAuthList(state) {},
};

const mutations = {
  SET_TOKEN: (state, token) => {
    state.token = token;
  },
};

const actions = {
  login({ commit }, userInfo) {
    const { username, password } = userInfo;
    return new Promise((resolve, reject) => {
      login({ username: username.trim(), password })
        .then((data) => {
          commit("SET_TOKEN", data.token);
          setToken(data.token); // 设置到 cookies 中
          resolve();
        })
        .catch(reject);
    });
  },

  logout({ commit, state, dispatch }) {
    return new Promise((resolve, reject) => {
      logout(state.token)
        .then(() => {
          dispatch("resetToken");
          resolve();
        })
        .catch(reject);
    });
  },

  resetToken({ commit }) {
    return new Promise((resolve) => {});
  },
};

export default { namespaced: true, state, getters, mutations, actions };
```

## 组件中直接使用

```js
export default {
  computed: {
    // 全局 getters
    isSuperAdmin() {
      return this.$store.getters.isSuperAdmin;
    },
    // 直接读模块 state
    userInfo() {
      return this.$store.state.user.userInfo;
    },
    // 带命名空间的模块 getters
    hasAuthList() {
      return this.$store.getters["user/hasAuthList"];
    },
  },
  methods: {
    login() {
      this.$store
        .dispatch("user/login", { username, password })
        .then(() => {})
        .catch(() => {});
    },
    async logout() {
      await this.$store.dispatch("user/logout");
    },
  },
};
```
