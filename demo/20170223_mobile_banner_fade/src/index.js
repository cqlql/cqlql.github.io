import './index.css'
import bannerFade from './banner-fade'

document.body.innerHTML=`
<div class="imgs">
  <img class="fade-in" src="https://img12.360buyimg.com/da/jfs/t9343/222/357649010/190898/cc531df1/59a66957N1e804bc7.jpg" alt="">
  <img src="https://img12.360buyimg.com/babel/jfs/t8500/326/472051068/94144/31ff4622/59a92889N105ccaee.jpg" alt="">
  <img src="https://img20.360buyimg.com/da/jfs/t6961/287/2292918286/205126/bb146e27/598abe52Nb1c8cfe4.jpg" alt="">
  <img src="https://img14.360buyimg.com/babel/jfs/t8149/307/410266219/149195/c95bbb55/59a7be23N0dfe46fc.jpg" alt="">
  <img src="https://img10.360buyimg.com/babel/jfs/t7873/333/2039410221/117759/23db7e0d/59a79758N9b31fd17.jpg" alt="">
</div>
<div class="btn1">
  <a href="javascript:void(0)">上一页</a>
  <a class="r" href="javascript:void(0)">下一页</a>
</div>
`

bannerFade({
  el:document.querySelector('.imgs')
})
