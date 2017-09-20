import './inertia-select.css'

import InertiaSelect from './inertia-select-base'

export default class {
  constructor(){

    let eRoot = document.querySelector('.slide-select')
    let eList=eRoot.querySelector('.s-sel-list')

    let eItems = eList.children

    let sels=[]

    function onChange() {
      sels.forEach(function (sel) {
        console.log(sel.currIndex)
      })
    }

    for(let i = 0,len=eItems.length; i<len;i++){
      let eMove = eItems[i]
      sels.push(new InertiaSelect({
        eDrag:eMove,
        eMove,onChange
      }))
    }

  }
}
