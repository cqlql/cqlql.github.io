## 文本框编辑改变事件 - input

但复制黏贴不会触发，坑爹啊，只能用 change:data 了

```js
editor.commands.get('input').on('execute', (evt, args) => {
  this.$emit('inputValue', editor.getData())
})
```

## 使用示例

```js
ClassicEditor.create(this.$el, {
  fontSize: {
    options: [12, 'default', 18, 20, 22],
  },
  // highlight: {
  //   options: [
  //     { model: 'yellowMarker', class: 'marker-yellow', title: 'Yellow Marker', color: 'var(--ck-highlight-marker-yellow)', type: 'marker' },
  //     { model: 'greenMarker', class: 'marker-green', title: 'Green marker', color: 'var(--ck-highlight-marker-green)', type: 'marker' },
  //     { model: 'pinkMarker', class: 'marker-pink', title: 'Pink marker', color: 'var(--ck-highlight-marker-pink)', type: 'marker' },
  //     { model: 'blueMarker', class: 'marker-blue', title: 'Blue marker', color: 'var(--ck-highlight-marker-blue)', type: 'marker' },
  //     { model: 'redPen', class: 'pen-red', title: 'Red pen', color: 'var(--ck-highlight-pen-red)', type: 'pen' },
  //     { model: 'greenPen', class: 'pen-green', title: 'Green pen', color: 'var(--ck-highlight-pen-green)', type: 'pen' }
  //   ]
  // },
  heading: {
    options: [
      { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
      { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
      { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
      { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
      { model: 'heading4', view: 'h4', title: '标题 4', class: 'ck-heading_heading4' },
      { model: 'heading5', view: 'h5', title: '标题 5', class: 'ck-heading_heading5' },
      // {
      //   model: 'headingFancy',
      //   view: {
      //     name: 'h2',
      //     classes: 'fancy'
      //   },
      //   title: 'Heading 2 (fancy)',
      //   class: 'ck-heading_heading2_fancy',

      //   // It needs to be converted before the standard 'heading2'.
      //   converterPriority: 'high'
      // }
    ],
  },
  // toolbar: [ 'heading', '|', 'bold', 'italic', 'link', 'bulletedList', 'numberedList', 'alignment', 'blockQuote', 'undo', 'redo' ],
  // language: 'zh-cn'
})
  .then((editor) => {
    this.editor = editor
    editor.setData(this.value)

    editor.model.document.on('change:data', () => {
      // 主动设置情况 不触发 inputValue
      if (this.autoset === true) {
        this.autoset = false
        return
      }
      this.$emit('inputValue', editor.getData())
    })
    // 文本框编辑改变事件，但
    // 复制黏贴不会触发，坑爹啊，只能用 change:data 了
    // editor.commands.get('input').on('execute', (evt, args) => {
    //   this.$emit('inputValue', editor.getData())
    // })
  })
  .catch((error) => {
    console.error(error)
  })
```

## 展示端需要的 css

https://ckeditor.com/docs/ckeditor5/latest/builds/guides/integration/content-styles.html
