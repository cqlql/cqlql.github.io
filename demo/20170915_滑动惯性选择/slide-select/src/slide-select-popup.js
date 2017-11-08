
import 'popup-bottom/popup-bottom.css'
import Popup from 'popup-bottom/popup-bottom'
import SlideSelect from './slide-select'

export default class extends SlideSelect {
  constructor () {
    super()
    this.popup = null
    // this.elMain = null
    // this.elTit = null
  }
  init () {
    let popup = this.popup = new Popup()
    popup.init()
    popup.setCont(this.getTemplate())

    let child = popup.elCont.children[0].children
    this.elTit = child[1]
    this.elMain = child[2]
    this.elInfo = child[0].querySelector('.s-info')
  }
  show () {
    this.popup.show()
  }
  getTemplate () {
    let html = `
<div class="slide-select">
  <div class="s-bar">
    <a class="cl-btn">取消</a>
    <a class="cfm-btn">确认</a>
    <div class="s-info"></div>
  </div>
  <div class="s-tit">
    <div class="s-t">标题</div>
  </div>
  <div class="s-main">
    <div class="s-list">
      <div class="s-sel">
        <div class="s-mask s-t-mask"></div>
        <div class="s-mask s-b-mask"></div>
        <ul class="s-move">
          <li class="s-item"></li>
        </ul>
      </div>
    </div>
  </div>
</div>
`
    return html
  }

  use (dataHandle) {
    dataHandle.init(this)
    this.dataHandle = dataHandle
  }
}
