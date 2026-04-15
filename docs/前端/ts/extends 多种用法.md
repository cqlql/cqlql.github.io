

## 条件判断
```typescript
interface Animal {
  live(): void;
}
interface Dog extends Animal {
  woof(): void;
}
 
type Example1 = Dog extends Animal ? number : string; // number
 
type Example2 = RegExp extends Animal ? number : string; // string

```

## 参考文档
[TypeScript中的extends - 掘金](https://juejin.cn/post/7033260509931503624)

