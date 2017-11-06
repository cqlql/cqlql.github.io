import '../css/common.css'
import '../css/report.css'
import Animation from './animation'
import toPercent from './to-percent'

/* eslint-disable no-undef */
if (isOther) {
  document.querySelector('.result-txt').style.display = 'block'
} else {
  document.querySelector('.det').style.display = 'block'
}

let {PI} = Math
let canvas = document.getElementById('canvas')
let basewh = 106
let p = 3 // window.innerWidth * 0.4 / basewh * 2
let wh = canvas.height = canvas.width = basewh * p
let ctx = canvas.getContext('2d')

function draw (v) {
  ctx.clearRect(0, 0, wh, wh)
  ctx.strokeStyle = '#ecedf1'
  ctx.lineWidth = 6 * p
  ctx.lineCap = 'round' // 末端样式

  ctx.beginPath()
  ctx.arc(53 * p, 53 * p, 50 * p, 0.5 * PI, 2.5 * PI)
  ctx.stroke()

  ctx.strokeStyle = '#71c81f'
  ctx.beginPath()
  ctx.arc(53 * p, 53 * p, 50 * p, 0.5 * PI, (0.5 + 2 * v) * PI)
  ctx.stroke()

  ctx.font = 12 * p + 'px serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = '#999'
  ctx.fillText('正确率', 50 * p, 30 * p)
  ctx.fillText('%', 66 * p, 62 * p)
  ctx.font = 20 * p + 'px serif'
  ctx.fillStyle = '#ff5757'
  ctx.fillText(toPercent(v.toFixed(2)), 50 * p, 62 * p)
}

draw(0)

let animation = new Animation()
let goValue = isOther ? 0.67 : 0.8
animation.start(p => {
  draw(p * goValue)
}, 1600)
