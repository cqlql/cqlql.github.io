import './popup-bottom.css'
import PopupBottom from './popup-bottom'

export default class {
  init (cb = () => {}) {
    this.init = function (cb) { cb() }

    let popupBottom = this.popupBottom = new PopupBottom()

    popupBottom.init()

    // 解决初始动画问题
    setTimeout(cb, 1)
  }

  show ({body, before = () => {}} = {}) {
    this.init(() => {
      let {elCont, popupBottom} = this

      if (body) {
        popupBottom.setCont(body)
      }

      before(elCont)

      popupBottom.show()
    })
  }

  close () {
    this.popupBottom.close()
  }
}
