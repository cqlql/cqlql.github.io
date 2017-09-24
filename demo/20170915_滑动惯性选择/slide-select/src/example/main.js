import './index.css'

import '../slide-select.css'
import SlideSelect from '../slide-select-popup'

let slideSelect = new SlideSelect()

let data = []
data = data.concat(getData(2017 - 10))
data = data.concat(data)

slideSelect.init()
slideSelect.setData(data)
slideSelect.setTits(['开始时间', '结束时间'])
slideSelect.onChange = function (i) {
  console.log('当前滑动项', i)
  let {sels} = this

  // 联动
  if (i < 2) {
    slideSelect.setData(getDayData(data[0][sels[0].currIndex], data[1][sels[1].currIndex]), 2)
  } else if (i === 3 || i === 4) {
    slideSelect.setData(getDayData(data[3][sels[3].currIndex], data[4][sels[4].currIndex]), 5)
  }

  updateInfo()
}
updateInfo()

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

// month 从1 开始
function getDayCount (year, month) {
  var d = new Date(year, month)
  d.setDate(0)
  return d.getDate()
}

function getDayData (year, month) {
  let days = []
  for (let i = 0, len = getDayCount(year, month); i < len; i++) {
    days.push(i + 1)
  }
  return days
}

function getData (startYear) {
  let data = [[], [], []]
  for (let i = 20; i--;) {
    data[0].push(startYear + i)
  }
  for (let i = 1; i < 13; i++) {
    data[1].push(i)
  }
  data[2] = getDayData(data[0][0], 1)
  return data
}

function updateInfo () {
  let {sels} = slideSelect
  slideSelect.elInfo.textContent = `${data[0][sels[0].currIndex]}/${data[1][sels[1].currIndex]}/${data[2][sels[2].currIndex]} - ${data[3][sels[3].currIndex]}/${data[4][sels[4].currIndex]}/${data[5][sels[5].currIndex]}`
}
