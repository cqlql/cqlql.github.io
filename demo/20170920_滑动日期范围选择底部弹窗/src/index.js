import './index.css'

// import 'popup-buttom/popup-buttom.css'
import Popup from './slide-select-popup/slide-select-popup'

let popup = new Popup([
  [2016, 2015, 1025, 11, 22, 33, 44, 55, 66],
  [2016, 2015, 1025, 11, 22, 33, 44, 55, 66],
])

document.querySelector('button').addEventListener('click', function () {
  popup.show()
})
