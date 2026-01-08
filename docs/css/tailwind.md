# tailwind

## @theme inline

inline theme 会在当前元素往上找，而普通 theme 中的变量引用只会找顶级

```css
@theme inline {
    --font-sans: var(--font-inter);
}
/*编译成*/
.font-sans {
    font-family: var(--font-inter);
}
```

```css
@theme {
    --font-sans: var(--font-inter);
}
/*编译成*/
.font-sans {
    font-family: var(--font-sans);
}
```