import SlideSelectBind from './slide-select-bind'

export default class {
  constructor () {
    this.elMain = null
    this.elTit = null
    this.sels = [] // 缓存列功能对象
    this.onChange = (i) => {
      console.log('当前滑动项', i)
      this.sels.forEach(function (sel) {
        console.log(sel.currIndex)
      })
    }
  }

  /**
   * 数据替换，随时都可以换
   * @param data array 两种数组格式：1 [1,2,3] ; 2 [[1,2,3],[11,22,33]] 。第一种数据格式可实现联动。使用第二种参数格式不能带参数 2 ，第二种处理会触发列数重新布局
   *
   * @param [index] number 可选，要替换的列，从左往右。不指定则所有列
   * */
  setData (data, index) {
    if (index === undefined) {
      this.setColByData(data)
      this.bind()
    } else {
      let html = ''
      data.forEach(function (v) {
        html += '<li class="s-item">' + v + '</li>'
      })
      console.log(this.elMain.children[index].querySelector('.s-move'))
      this.elMain.children[index].querySelector('.s-move').innerHTML = html
      let sel = this.sels[index]
      sel.update()
    }
  }

  /**
   * 设置列标题
   * @param tits array/string 处理所有(将重新生成元素)/处理单个。处理单个情况需指定 index
   * @param index number 可选，要替换的标题，默认0
   * */
  setTits (tits, index = 0) {
    if (typeof tits === 'string') {
      this.elTit.children[index] = tits
    } else {
      let html = ''
      tits.forEach(function (t) {
        html += `<div class="s-t">${t}</div>`
      })
      this.elTit.innerHTML = html
    }
  }

  /**
   * 单纯设置列数，重新布局 -- 目前未使用，意义不大
   * 需重新执行 bind 绑定功能
   * */
  // setCol (col) {
  //   let elItemsHtml = ''
  //   for (let i = col; i--;) {
  //     elItemsHtml += '<div class="s-list"><div class="s-sel"><div class="s-mask s-t-mask"></div><div class="s-mask s-b-mask"></div><ul class="s-move">'
  //     elItemsHtml += '</ul></div></div>'
  //   }
  //   this.elMain.innerHTML = elItemsHtml
  // }

  /**
   * data 格式：[[1,2,3],[11,22,33]]
   * */
  setColByData (data) {
    let elItemsHtml = ''
    data.forEach(function (d) {
      elItemsHtml += '<div class="s-list"><div class="s-sel"><div class="s-mask s-t-mask"></div><div class="s-mask s-b-mask"></div><ul class="s-move">'
      d.forEach(function (v) {
        elItemsHtml += '<li class="s-item">' + v + '</li>'
      })
      elItemsHtml += '</ul></div></div>'
    })
    this.elMain.innerHTML = elItemsHtml
  }

  /**
   * 绑定功能
   * */
  bind () {
    let elItems = this.elMain.children

    let sels = this.sels = []

    for (let i = 0, len = elItems.length; i < len; i++) {
      let eDrag = elItems[i]
      let eMove = eDrag.querySelector('.s-move')
      sels.push(new SlideSelectBind({
        eDrag,
        eMove,
        onChange: () => {
          this.onChange(i)
        }
      }))
    }
  }
}
