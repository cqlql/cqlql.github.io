import './index.css'
import getxyByRad from './getxy-by-rad'
import pie from './pie'

function chartPie({data,eachData,labels,tscore}) {

// 圆心
  let ox = 100
  let oy = 60

// 半径
  let r = 50

// 圆心发散偏移值
  let oft = 1

// 底色值
  let bgcs = ['#fff1e7', '#fff5e1', '#ffefef', '#f1f5ff', '#edf7ff']
  let eachBgcs = ['#ffbb87', '#ffc966', '#ffa9ab', '#bbc7ff', '#a3d1ff']
  let lcs = ['#f96902', '#ffad14', '#ff4b4b', '#5980ff', '#5bacfe']

// 起始弧度
  let angOft = 120
  let sRad = Math.PI / 180 * -angOft
  let paths = ''
  let texts = ''
  data.forEach(function (p, i) {
    let rad = p * Math.PI * 2

    paths += `<path d="${pie({
      ox, oy, r, sRad, rad, oft
    })}"
fill="${bgcs[i % 5]}"
></path>`

    let r2 = (r-3) * (eachData[i])+1.5
    paths += `<path d="${pie({
      ox, oy, r: r2, sRad, rad, oft
    })}"
fill="${eachBgcs[i % 5]}"
></path>`

    // 画边框
    paths += `<path d="${pie({
      ox, oy, r, sRad, rad, oft
    })}"
fill="transparent"
stroke="#fff" stroke-width="3"
></path>`

    // 画线，并记录文本坐标
    let ra = sRad + rad / 2
    let exOft = 3 // 末端折线偏移
    let txOft = 1 // 文本偏移

    if (180 / Math.PI * ra + 90 > 180) {
      exOft = -exOft
      txOft = -txOft
    }
    let lR2 = r2 / 1.2 // 内部饼图线条起始半径，用来算坐标
    console.log(lR2)
    let {x: sx, y: sy} = getxyByRad(ra, lR2>1.5?lR2:1.5, ox, oy)// 起始坐标
    let {x: ex, y: ey} = getxyByRad(ra, r+2, ox, oy)
    let tx = ex + exOft, ty = ey
    paths += `<polyline points="${sx},${sy} ${ex},${ey} ${tx},${ty}"
fill="none"
stroke="${lcs[i % 5]}"
stroke-width="0.5"
></polyline>`
    // div文本
    // texts += `<div class="lb" style="left:${(tx) / 200 * 100}%;top:${(ty) / 200 * 100}%;"><span style="${exOft > 0 ? '' : 'float:right;'}color:${lcs[i % 5]}">${labels[i]}</span></div>`
    // svg 文本
    texts+=`<text x="${tx+txOft}" y="${ty+3}" font-size="6.5" text-anchor="${exOft>0?'start':'end'}" fill="${lcs[i % 5]}">${labels[i]}</text>`

    sRad += rad
  })

// 总分
// texts += `<div class="tscore">${tscore}分</div>`
texts+=`<text x="${ox}" y="${oy+3}" font-size="6.5" text-anchor="middle" fill="#333" style="font-weight:bold;">${tscore}分</text>`

document.querySelector('.chart-pie').innerHTML=`<svg viewbox="0,0,200,120">${paths}${texts}</svg>`
  // document.querySelector('.chart-pie').innerHTML = `<!--<svg viewbox="0,0,200,200">${paths}</svg>-->${texts}`
}

window.transmitData = function (baseData) {

  // 扇形占比
  let data = []
  let eachData = []
  let labels = []
  let tscore = 0

  baseData.forEach(function (d) {
    let {weight,score,dimension_name} = d
    let w = weight/100
    data.push(w)
    eachData.push(score/100)
    labels.push(dimension_name+':'+score+'分')
    tscore+=score * w
  })

  chartPie({
    data,
    eachData,
    labels,
    tscore
  })
}
