## 函数式组件

```tsx
type WelcomeProps = {
  name?: string;
};

const Welcome: React.FC<WelcomeProps> = (props) => {
  useEffect(() => {
    document.title = "加载完成";
  });
  return <h1>Hello, {props.name}</h1>;
};
```
