/* v1.1.0 */
import './slide-select.css'

import SlideSelect from './slide-select-base'

export default class {
  constructor() {


    let eRoot = document.querySelector('.slide-select')
    let eList=eRoot.querySelector('.s-main')

    let eItems = eList.children

    let sels=[]

    function onChange() {
      sels.forEach(function (sel) {
        console.log(sel.currIndex)
      })
    }

    for(let i = 0,len=eItems.length; i<len;i++){
      let eDrag = eItems[i]
      let eMove = eDrag.querySelector('.s-move')
      sels.push(new SlideSelect({
        eDrag,
        eMove,onChange
      }))
    }

    sels[0].select(1)
  }

  init(){

  }

}
