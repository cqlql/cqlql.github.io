import './index.css'

import './popup-buttom/popup-buttom.css'
import Popup from './popup-buttom/popup-buttom'

let popup = new Popup

document.querySelector('button').addEventListener('click', function () {
  popup.show({
    body: 123
  })
})
