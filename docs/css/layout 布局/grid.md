## 容器属性

### 行列数、行列大小控制

1. grid-template-columns 列
2. grid-template-rows 行

```css
/* 

fr 

2栏，比例宽度，第2栏是第1栏的2倍

值格式：[正整数]fr
*/
.container {
  display: grid;
  grid-template-columns: 1fr 2fr;
}

/*
2栏，比例宽度，按容器百分比分
*/
.container {
  display: grid;
  grid-template-columns: 70% 30%;
}

/* 

repeat

2栏，并且都是 50%
*/
.container {
  display: grid;
  grid-template-columns: repeat(2, 50%);
}

/* 
repeat

6栏，模式重复
*/
.container {
  display: grid;
  grid-template-columns: repeat(2, 100px 20px 80px);
}

/* 
repeat 、 auto-fill

按容器宽度自动列，放不下换行。使用 auto-fill 关键字。
下例表示，每列宽度100px，然后自动填充，直到容器不能放置更多的列。
*/
.container {
  display: grid;
  grid-template-columns: repeat(auto-fill, 100px);
}

/* 
minmax

第 3 栏，最小 100px 最大 1fr 
*/
.container {
  display: grid;
  grid-template-columns: 1fr 1fr minmax(100px, 1fr);
}

/* 
auto 适应剩下的宽度
 
*/
.container {
  display: grid;
  grid-template-columns: 100px auto 100px;
}
```

### 控制间距

grid-row-gap 、 grid-column-gap 、 grid-gap

```css
.container {
  grid-gap: 20px;
}
/* 等于 */
.container {
  grid-gap: 20px 20px;
}
/* 等于 */
.container {
  grid-row-gap: 20px;
  grid-column-gap: 20px;
}
```

### 区域 - 可合并、可指定项位置

grid-template-areas 属性

如果某些区域不需要利用，则使用"点"（.）表示。

下例值 `a a` 表示合并这两个单元格

结合项目属性 grid-area 指定项目放置位置

```css
.container {
  display: grid;
  grid-template-columns: 100px 100px 100px;
  grid-template-rows: 100px 100px 100px;
  grid-template-areas:
    'a a c'
    'd . f'
    'g . i';
}

.item-1 {
  /* 放置在 g 位置 */
  grid-area: g;
}
```

### 布局方向 - 从上往下还是从左往右

`grid-auto-flow` 属性，可设值 `column` 或 `row`

```css
/* 
值 column ：从上往下，第1列满了，再换第2列
*/
.container {
  grid-auto-flow: column;
}

/* 
值 row ：从左往右，第1行满了，再换第2行
*/
.container {
  grid-auto-flow: row;
}

/* 
值 dense ：尽可能紧密填满，不出现空格
*/
.container {
  grid-auto-flow: row dense;
}
```

### 单元格内容水平垂直位置控制

- justify-items 属性
- align-items 属性
- place-items 属性

```css
.container {
  justify-items: start | end | center | stretch;
  align-items: start | end | center | stretch;
}
```

### 整个 grid 水平垂直位置控制

- justify-content 属性
- align-content 属性
- place-content 属性

```css
.container {
  justify-content: start | end | center | stretch | space-around | space-between | space-evenly;
  align-content: start | end | center | stretch | space-around | space-between | space-evenly;
}
```

### 控制剩下的行或列

grid-auto-rows 属性

```css
.container {
  display: grid;
  /* 3 行 3 列 */
  grid-template-columns: 100px 100px 100px;
  grid-template-rows: 100px 100px 100px;

  /* 多出的行都设置成 50px 高 */
  grid-auto-rows: 50px;
}
```

### 简写

- grid-template 属性
- grid 属性

grid-template 属性是 grid-template-columns、grid-template-rows 和 grid-template-areas 这三个属性的合并简写形式。

grid 属性是 grid-template-rows、grid-template-columns、grid-template-areas、 grid-auto-rows、grid-auto-columns、grid-auto-flow 这六个属性的合并简写形式。

从易读易写的角度考虑，建议不要合并属性

## 项目属性

### 区域位置

grid-area 属性。结合 grid-template-areas 使用

### 项位置

- grid-column-start 属性
- grid-column-end 属性
- grid-row-start 属性
- grid-row-end 属性

可使用 grid-column 、grid-row 属性简写

### 项内容水平垂直位置

- justify-self 属性
- align-self 属性
- place-self 属性

## 参考

[CSS Grid 网格布局教程 - 阮一峰的网络日志](https://www.ruanyifeng.com/blog/2019/03/grid-layout-tutorial.html)
