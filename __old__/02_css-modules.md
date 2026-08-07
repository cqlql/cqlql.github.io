

**由文件划分模块**

文件 a.css 相同 className 编译后依然相同

文件 a.css 与 b.css 中 className 即使有相同，编译后不一样

**不转换**

```css
:global .cf { clear: both; }
```

## 复用

```css
.className {
  color: green;
  background: red;
}

.otherClassName {
  composes: className;
  color: yellow;
}
```
