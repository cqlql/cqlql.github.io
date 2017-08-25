
import getxyByRad from '../../../modules/pie/getxy-by-rad'
import pie from '../../../modules/pie/pie'

export default function ({labels}) {
  // let labels = [11111,2,3,4,'谢谢参与',6,7]

  let num = 7

// 圆心
  let ox = 100
  let oy = 100

// 半径
  let r = 100

// 底色值
  let bgcs = ['#f65b49', '#fff']
  let lcs = ['#fff','#f6af34']

// 偏移弧度
  let angOft = 120
// 起始弧度
  let sRad = Math.PI / 180 * -angOft
// 每块弧度
  let rad = Math.PI * 2 / num

  let paths =''
  let texts =''
  for(let i=0;i<num;i++){
    let bc = bgcs[(i>4?i+1:i) % 2]
    let lc = lcs[(i>4?i+1:i) % 2]

    if(i===4){
      bc='#777'
      lc = '#fff'
    }

    paths += `<path d="${pie({ ox, oy, r, sRad, rad })}" fill="${bc}"></path>`

    let ra = sRad + rad / 2
    let {x, y} = getxyByRad(ra, r-26, ox, oy)

    texts+=`<text x="${x}" y="${y}" font-size="10" text-anchor="middle" fill="${lc}" transform="rotate(${180/Math.PI *ra+90},${x},${y})"  style="font-weight:bold;">${labels[i]}</text>`

    sRad += rad
  }

   return `<svg viewBox="0,0,200,200">${paths+texts}<circle cx="${ox}" cy="${oy}" r="${r-3}" stroke="rgba(0, 0, 0, 0.3)" fill="transparent" stroke-width="6"/></svg>`

}
