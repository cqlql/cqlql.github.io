---
title: tsconfig 配置
icon: devicon:json
sort: 15
---

常用 `tsconfig.json` 示例：

```jsonc
{
  "compilerOptions": {
    "target": "es5",
    "module": "esnext",
    "strict": true,
    "jsx": "preserve",
    "importHelpers": true,
    "moduleResolution": "node",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "useDefineForClassFields": true,
    "sourceMap": true,
    "baseUrl": ".",
    // 引入 node_modules 中的模块类型
    "types": ["webpack-env", "jest"],
    "paths": {
      "@/*": ["src/*"]
    },
    "lib": ["esnext", "dom", "dom.iterable", "scripthost"]
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.tsx",
    "src/**/*.vue",
    "tests/**/*.ts",
    "tests/**/*.tsx",
    // 也可引入全局类型
    "types/**/*.d.ts"
  ],
  "exclude": ["node_modules"]
}
```

> 注意：`compilerOptions.types` 只控制**全局类型包**的自动包含，不能用于把某个普通 npm 包的类型"导出为全局"（见 [声明文件与类型扩展](./声明文件与类型扩展.md)）。
