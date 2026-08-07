- [input [type=text]、textarea](#input-typetexttextarea)
  - [css](#css)
    - [-webkit-text-fill-color](#-webkit-text-fill-color)
    - [控制 placeholder 颜色](#控制-placeholder-颜色)
    - [去掉红色波浪线](#去掉红色波浪线)
- [问题](#问题)
  - [ios disabled="disabled" 淡灰 不可控 问题](#ios-disableddisabled-淡灰-不可控-问题)
- [[type=file]](#typefile)
  - [移动端调用设备](#移动端调用设备)
  - [js](#js)

## input [type=text]、textarea

### css

#### -webkit-text-fill-color

```css
input {
  -webkit-text-fill-color: #333;
}
```

同时覆盖 placeholder、color 颜色，那不是没什么用吗。。

#### 控制 placeholder 颜色

```css
input::placeholder {
  color: #aaa;
}
```

#### 去掉红色波浪线

```html
<textarea spellcheck="false"></textarea>
```

## 问题

### ios disabled="disabled" 淡灰 不可控 问题

涉及得元素控件：input [type=text]、textarea

css color 颜色无效。网上 opacity 也无法理想解决

**理想解决：** 使用 readonly="readonly" 代替

## [type=file]

[input type="file" | MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file#attr-capture)

### 移动端调用设备

```html
<!-- 文件选择 -->
<input type="file" accept="image/*" />
<!-- 拍照 -->
<input type="file" accept="image/*" capture="camera" />
<!-- 录像 -->
<input type="file" accept="video/*" capture="camcorder" />
<!-- 录音 -->
<input type="file" accept="audio/*" capture="microphone" />
```

### js

编程式调用情况，input file 必须加到页面中

```js
let file = document.createElement('input')
file.type = 'file'

// ie6+包括ie11，还有部分移动端，比如iPhone，file 元素必须加到页面中
file.style.display = 'none'
document.body.appendChild(file)

file.onchange = () => {
  this.upload(file.files[0]).then((url) => {
    url && this.imgs.push(url)
  })
}
file.click()
```
