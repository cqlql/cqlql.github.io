import 'popup-buttom/popup-buttom.css'
import Popup from 'popup-buttom/popup-buttom'
// import slideSelec from 'popup-buttom/popup-buttom'
import 'slide-select/slide-select.css'
import SlideSelect from 'slide-select/slide-select-base'

export default class {
  constructor(data) {
    this.data=data
  }

  init() {
    this.init = function () {
    }

    this.popup = new Popup
  }

  slideInit(elCont){
    let {data} = this

    let eRoot = elCont.querySelector('.slide-select')
    let eList = eRoot.querySelector('.s-main')

    let eItems = eList.children

    let sels = []

    function onChange() {
      sels.forEach(function (sel,i) {

        console.log(data[i][sel.currIndex])
      })
    }

    for (let i = 0, len = eItems.length; i < len; i++) {
      let eDrag = eItems[i]
      let eMove = eDrag.querySelector('.s-move')
      sels.push(new SlideSelect({
        eDrag,
        eMove, onChange
      }))
    }
  }

  buildSlideHtml() {
    let {data}=this

    let bd = ''
    data.forEach(function (d) {
      bd += '<div class="s-list"><div class="s-sel"><div class="s-mask s-t-mask"></div><div class="s-mask s-b-mask"></div><ul class="s-move">'
      d.forEach(function (v) {
        bd+='<li class="s-item">'+v+'</li>'
      })
      bd+='</ul></div></div>'
    })


    let html = `
<div class="slide-select">
  <div class="s-bar">
    <a class="cl-btn">取消</a>
    <a class="cfm-btn">确认</a>
  </div>
  <div class="s-tit">
    <div class="s-t">开始时间</div>
    <div class="s-t">结束时间</div>
  </div>
  <div class="s-main">${bd}</div>
</div>`

    return html
  }

  show() {
    this.init()

    let {popup} = this

    popup.show({
      body: this.buildSlideHtml(),
      before: (elCont) => {
        this.slideInit(elCont)
      }
    })
  }

  close() {
    this.close()
  }
}
