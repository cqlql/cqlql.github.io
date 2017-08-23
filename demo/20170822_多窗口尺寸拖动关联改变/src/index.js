
import './index.css'

// import DragRelateSize from './js/drag-relate-size'
// import MoveHandle from './js/move-handle'
import {MoveHandle,DragRelateSize} from 'drag-relate-size'

let typeMenu = document.querySelector('.type-menu')
let menu = document.querySelector('.menu')
let leftNav = document.querySelector('.left-nav')
let rightCont = document.querySelector('.right-cont')

let leftNavDrag=new DragRelateSize({
  elem:leftNav,
  onDown(){
    leftNavDrag.minWidth = typeMenuDrag.currWidth + 10
    rightContMove.minWidth = leftNavDrag.minWidth + 10
    rightContMove.maxWidth = leftNavDrag.maxWidth = leftNavDrag.currWidth + rightCont.clientWidth-10
    leftNavDrag.maxWidth = rightContMove.maxWidth -10

    rightContMove.down()
  },
  onMove(x){
    rightContMove.move(x,function (x) {
      rightCont.style.marginLeft = x + 'px'
    })
  }
})

let rightContMove = new MoveHandle({initWidth:leftNavDrag.currWidth + 10})

let typeMenuDrag=new DragRelateSize({
  elem:typeMenu,
  onDown(){
    typeMenuDrag.maxWidth = leftNavDrag.currWidth - 10
  }
})


