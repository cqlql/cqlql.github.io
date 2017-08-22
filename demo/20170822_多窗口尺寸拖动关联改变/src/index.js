
import './index.css'

import dragRelateSize from './js/drag-relate-size'

let leftNav = document.querySelector('.type-menu')
let menu = document.querySelector('.menu')

dragRelateSize({
  elem:leftNav,
  onMove(x){
    menu.style.width = 200-x+ 'px'
  }
})
