## 约束常用 `process.env.NODE_ENV`

```ts
declare namespace NodeJS {
  interface Process {
    env: {
      NODE_ENV: 'production' | 'development'
    }
  }
}
```
