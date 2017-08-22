
/**
 *
 * 必须确保参数 elem 非 static 定位
 * */

import {dragPlus} from 'corejs'

export default function dragRelateSize({elem,onMove}) {

  let bar = document.createElement('div')

  bar.setAttribute('style',`position:absolute;
    right: -5px;
    top: 0;
    bottom: 0;
    width: 10px;cursor: e-resize;`)

  elem.appendChild(bar)

  let width = parseFloat(window.getComputedStyle(elem, null).getPropertyValue('width'))
  let left=0
  dragPlus({
    eDrag:bar,
    onMove({x}){
      left+=x
      elem.style.width = width+left+'px'
      onMove(left)
    }
  })

}

