/**
 *
 * 参数 elem 在非 static 定位的情况会自动设置为 relative
 *
 * 目前只实现 x 方向
 * */

import {dragPlus} from 'corejs'

export default function dragRelateSize({elem,onDown, onMove,onUp=()=>{},minWidth=0,rightWidth,initWidth}) {

  let bar = document.createElement('div')

  bar.setAttribute('style', `position:absolute;
    right: -5px;
    top: 0;
    bottom: 0;
    width: 10px;cursor: e-resize;`)

  elem.appendChild(bar)

  let style = window.getComputedStyle(elem, null)
  let isStatic = style.getPropertyValue('position') === 'static'
  initWidth = initWidth===undefined? parseFloat(style.getPropertyValue('width')):initWidth

  if(isStatic){
    elem.style.position  = 'relative'
  }

  let width = initWidth
  let maxWidth = setMaxWidth()
  dragPlus({
    eDrag: bar,
    onDown(e) {
      onDown()

      if (e.cancelable) e.preventDefault()
    },
    onMove({x, event}) {

      width += x

      if (width < minWidth) {
        width = minWidth
      } else if(width>maxWidth){
        width = maxWidth
      }

      onMove(x)

      elem.style.width = width + 'px'
      //
    },
    onUp
  })

  function setMaxWidth() {
    return maxWidth = rightWidth + width -minWidth
  }

  return {
    setWidth(w){
      width = w
    },
    getWidth(){
      return width
    },
    getMaxWidth(){
      return maxWidth
    },
    setRightWidth(w){
      rightWidth = w
    },
    setMaxWidth
  }
}
