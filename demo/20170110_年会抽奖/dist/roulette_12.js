webpackJsonp([6,7],{1:function(t,e,n){"use strict";function u(){var t=void 0,e=navigator.userAgent.match(/Android (\d.\d)/);return t=e&&e[1],u=function(){return t},t}function o(t,n){u()&&u()<4.4||/iPad|iPhone/.test(navigator.userAgent)?e.default=o=function(t,e){function n(t){i||e.call(this,t)}function u(){i=!1}function o(){i=!0}var i=void 0;return t.addEventListener("touchend",n),t.addEventListener("touchstart",u),t.addEventListener("touchmove",o),function(){t.removeEventListener("touchend",n),t.removeEventListener("touchstart",u),t.removeEventListener("touchmove",o)}}:e.default=o=function(t,e){return t.addEventListener("click",e),function(){t.removeEventListener("click",e)}},o(t,n)}Object.defineProperty(e,"__esModule",{value:!0}),e.default=o},22:function(t,e,n){"use strict";function u(t){return t&&t.__esModule?t:{default:t}}function o(t,e){function n(){function t(){requestAnimationFrame(function(){i++,(i>c&&s===!1||a>0)&&(i=c),s&&i>c?(e(),o=n(null,i,0,f,r),d=n(null,i-1,0,f,r),g+=o-d):(o=n(null,i,0,f,r),d=n(null,i-1,0,f,r),g+=o-d),w.$refs.eRotate.style[_]="rotate3d(0,0,1,"+g+"deg)",a--,i<r?t():u()})}function e(){if(void 0===e.noFirst){var t=g-360*~~(g/360),n=360+v[l][0]-t;n%=360,n<226&&(n+=360),f=2*n,e.noFirst=1}}function n(t,e,n,u,o){return(e/=o/2)<1?u/2*e*e+n:-u/2*(--e*(e-2)-1)+n}var o,i=0,r=200,c=r/2,d=0,s=!1,a=120,f=900;t(),window.priceResult=function(t){t>=0?(l=t,p=!0):(l=1,p=!1),s=!0}}function u(){y=!1,b=600}function o(){function t(){e?(f.style[_]="rotate3d(0,0,1,35deg)",e=0):(f.style[_]="rotate3d(0,0,1,0deg)",e=1),setTimeout(t,b)}var e;t()}function i(){var t,e=document.querySelector(".lottery-page"),n=e.querySelector(".dish");t=n.children,c=t[2],s=t[0],f=t[1]}var c,s,f,l=0,v={},h=10,m=!0,p=!1,y=!1,g=0,_=(0,a.default)("transform")[1],b=600,w=new r.default({el:".dish",data:{dishType:t,count:e},computed:{dishImg:function(){return"css/imgs/dish"+this.dishType+".png"}},directives:{click:{inserted:function(t){var e=arguments[2].context;(0,d.default)(t,function(){y===!1&&(new Audio(startAudio.src).play(),m&&h>0&&(y=!0,b=200,n()),setTimeout(function(){priceResult(~~(Math.random()*e.count))},200))})}}},watch:{count:function(){this.countUpdate()}},methods:{countUpdate:function(){for(var t=this.count,e=0;e<t;e++)v[e]={0:360*e/t,1:360/t}}},mounted:function(){this.countUpdate()}});i(),o()}Object.defineProperty(e,"__esModule",{value:!0}),e.default=o;var i=n(12),r=u(i),c=n(1),d=u(c),s=n(7),a=u(s)},7:function(t,e,n){"use strict";function u(t){var e=u[t];if(void 0!==e)return e;for(var n,o=t[0],i=o.toUpperCase(),r=["ms"+i,"Moz"+i,"webkit"+i,o],c=["-ms-","-Moz-","-webkit-",""],d=document.body.style,s=t.replace(/-\w/g,function(t){return t[1].toUpperCase()}).substr(1),a=r.length;a--;)if(n=r[a]+s,n in d){e=[c[a]+t,n];break}return e=e||null,u[t]=e,e}Object.defineProperty(e,"__esModule",{value:!0}),e.default=u},72:function(t,e,n){"use strict";function u(t){return t&&t.__esModule?t:{default:t}}var o=n(22),i=u(o);(0,i.default)(2,12)}},[72]);