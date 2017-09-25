import './index.css'

import '../slide-select.css'
import SlideSelect from '../slide-select-popup'
import DateRange from '../date-range-data'

let slideSelect = new SlideSelect()
slideSelect.init()
slideSelect.use(new DateRange())

slideSelect.onChange = function () {
  console.log(this.dataHandle.result)
}

// dateRange.init(slideSelect)

document.querySelector('#test1').addEventListener('click', function () {
  slideSelect.show()
})

document.querySelector('#test2').addEventListener('click', function () {
  slideSelect.show()
  setTimeout(function () {
    slideSelect.setData([66, 77, 88], 1)
  }, 500)
})

document.querySelector('#test3').addEventListener('click', function () {
  slideSelect.show()
  setTimeout(function () {
    slideSelect.setData([[1, 2, 3], [11, 22, 33], [111, 222, 333]])
  }, 500)

  slideSelect.onChange = function (i) {
    console.log('当前滑动项', i)
  }
})
