
import './index.css'

import dragRelateSize from './js/drag-relate-size'

let typeMenu = document.querySelector('.type-menu')
let menu = document.querySelector('.menu')

// let initWidth = 200
let minWidth = 10
let menuWidth = 200
let maxMenuWidth
let typeMenuHandle = dragRelateSize({
  elem:typeMenu,
  minWidth,
  rightWidth:menuWidth,
  onDown(){
    typeMenuHandle.setRightWidth(menuWidth)
    typeMenuHandle.setMaxWidth()
    maxMenuWidth = typeMenuHandle.getMaxWidth()
  },
  onMove(x){
    menuWidth -= x

    if (menuWidth < minWidth) {
      menuWidth = minWidth
    }
    else if(menuWidth>maxMenuWidth){
      menuWidth = maxMenuWidth
    }

    menu.style.width = menuWidth + 'px'
  },
  onUp(){

  }
})

let leftNav = document.querySelector('.left-nav')
let rightCont = document.querySelector('.right-cont')

let leftNavWidht = menuWidth + typeMenuHandle.getWidth()
let rightContLeft=leftNavWidht+10
let minLeftNavWidht
let maxLeftNavWidth
let minRightContLeft
let maxRightContLeft
let menuHandle = dragRelateSize({
  elem:menu,
  minWidth,
  initWidth:menuWidth,
  onDown(){
    let rightContWidth = rightCont.clientWidth
    minLeftNavWidht = typeMenuHandle.getWidth() + minWidth
    minRightContLeft=minLeftNavWidht+10

    maxRightContLeft = leftNavWidht + rightContWidth
    maxLeftNavWidth = maxRightContLeft +10

    menuHandle.setRightWidth(rightContWidth)

    menuHandle.setWidth(menuWidth)

    menuHandle.setMaxWidth()
  },
  onMove(x){
    leftNavWidht+=x
    rightContLeft+=x

    if(leftNavWidht<minLeftNavWidht){
      leftNavWidht=minLeftNavWidht
    } else if(leftNavWidht>maxLeftNavWidth){
      leftNavWidht = maxLeftNavWidth
    }

    if(rightContLeft<minRightContLeft){
      rightContLeft=minRightContLeft
    } else if(rightContLeft>maxRightContLeft){
      rightContLeft = maxRightContLeft
    }

    leftNav.style.width = leftNavWidht + 'px'
    rightCont.style.marginLeft = rightContLeft + 'px'
  },
  onUp(){
    menuWidth = menuHandle.getWidth()
  }
})
